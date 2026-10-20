import { NextRequest } from "next/server";
import { createSubscriber, isRedisAvailable } from "@markless/server/src/lib/redis/client-v2";
import { authorizeTranscriptionStream } from "@markless/server/src/lib/transcriptions/access";
import { buildTranscriptionEventChannel } from "@markless/shared/src/lib/transcriptions/events";
import { createTranscriptionStreamToken } from "@markless/shared/src/lib/transcriptions/tokens";
import {
  getTranscriptionJobByPublicId,
  serializeTranscriptionReadResponse,
} from "@markless/server/src/lib/transcriptions/service";
import { buildSseCorsHeaders } from "../../../../../lib/sse-cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function formatSsePayload(payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function closeController(controller: ReadableStreamDefaultController<Uint8Array>) {
  try {
    controller.close();
  } catch {
    // ignore controller close errors
  }
}

function buildStreamTokenOrNull(
  publicId: string,
  options?: {
    anonymousSessionId?: string | null;
  }
): string | null {
  try {
    return createTranscriptionStreamToken(publicId, {
      anonymousSessionId: options?.anonymousSessionId ?? null,
    });
  } catch (error) {
    console.error("[Transcriptions] Failed to create stream token for SSE", error);
    return null;
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const access = await authorizeTranscriptionStream(request, id);
  const corsHeaders = buildSseCorsHeaders(request);

  if ("reason" in access) {
    return new Response(access.reason === "not_found" ? "Not Found" : "Forbidden", {
      status: access.reason === "not_found" ? 404 : 403,
      headers: corsHeaders ?? undefined,
    });
  }

  const encoder = new TextEncoder();
  let cancelStream: (() => void) | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      let polling: ReturnType<typeof setInterval> | null = null;
      let subscriber: ReturnType<typeof createSubscriber> | null = null;
      let lastUpdatedAt = access.job.updatedAt.toISOString();

      const cleanup = async () => {
        if (closed) {
          return;
        }
        closed = true;
        cancelStream = null;

        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }

        if (polling) {
          clearInterval(polling);
          polling = null;
        }

        request.signal.removeEventListener("abort", onAbort);

        if (subscriber) {
          try {
            await subscriber.quit();
          } catch {
            // ignore cleanup errors
          }
          subscriber = null;
        }

        closeController(controller);
      };

      const send = (payload: Record<string, unknown>) => {
        if (closed) {
          return;
        }
        controller.enqueue(encoder.encode(formatSsePayload(payload)));
      };

      const onAbort = () => {
        void cleanup();
      };

      request.signal.addEventListener("abort", onAbort);
      cancelStream = () => {
        void cleanup();
      };

      try {
        const initialStreamToken = buildStreamTokenOrNull(access.job.publicId, {
          anonymousSessionId:
            access.mode === "anonymous" ? access.job.anonymousSessionId : null,
        });
        send({
          type: "snapshot",
          ...(await serializeTranscriptionReadResponse(access.job, initialStreamToken)),
        });
      } catch (error) {
        console.error("[Transcriptions] Failed to serialize SSE snapshot", error);
        closeController(controller);
        return;
      }

      heartbeat = setInterval(() => {
        send({
          type: "heartbeat",
          timestamp: Date.now(),
        });
      }, 15000);

      if (isRedisAvailable()) {
        subscriber = createSubscriber(`transcription-${access.job.publicId}`);
        await subscriber.subscribe(buildTranscriptionEventChannel(access.job.publicId));
        subscriber.on("message", (_channel, message) => {
          try {
            const parsed = JSON.parse(message) as {
              type?: string;
              task?: unknown;
              aiArtifacts?: unknown;
              translations?: unknown;
              completedTranslation?: unknown;
            };
            if (parsed.type === "transcription.updated" && parsed.task) {
              send({
                type: "update",
                task: parsed.task,
                aiArtifacts: parsed.aiArtifacts ?? {
                  summary: null,
                  mind_map: null,
                },
                translations: parsed.translations ?? {},
                completedTranslation: parsed.completedTranslation ?? null,
              });
            }
          } catch {
            // ignore malformed realtime payloads
          }
        });
        return;
      }

      polling = setInterval(async () => {
        try {
          const latest = await getTranscriptionJobByPublicId(access.job.publicId);
          if (!latest) {
            return;
          }

          const updatedAt = latest.updatedAt.toISOString();
          if (updatedAt === lastUpdatedAt) {
            return;
          }

          lastUpdatedAt = updatedAt;
          const nextStreamToken = buildStreamTokenOrNull(latest.publicId, {
            anonymousSessionId: latest.userId ? null : latest.anonymousSessionId,
          });
          send({
            type: "update",
            ...(await serializeTranscriptionReadResponse(latest, nextStreamToken)),
          });
        } catch (error) {
          console.error("[Transcriptions] Failed to stream polling update", error);
        }
      }, 3000);
    },
    cancel() {
      cancelStream?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...(corsHeaders ?? {}),
    },
  });
}
