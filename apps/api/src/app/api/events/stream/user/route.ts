/**
 * User-scoped SSE stream for realtime events.
 */

import { NextRequest } from "next/server";
import { auth } from "@markless/server/src/lib/auth/server";
import { getSubscriptionPool } from "@markless/server/src/lib/redis/subscription-pool";
import { buildSseCorsHeaders } from "../../../../../lib/sse-cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const corsHeaders = buildSseCorsHeaders(req);
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id ?? null;

  if (!userId) {
    return new Response("Unauthorized", {
      status: 401,
      headers: corsHeaders ?? undefined,
    });
  }

  const clientId = req.nextUrl.searchParams.get("clientId")?.trim() || "unknown";
  const subscriptionKey = `sse:${clientId}`;

  const encoder = new TextEncoder();
  let cancelStream: (() => void) | null = null;
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let cleanedUp = false;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      let unsubscribe: (() => void) | null = null;

      const cleanup = (shouldCloseController = true) => {
        if (cleanedUp) return;
        cleanedUp = true;
        closed = true;
        cancelStream = null;

        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }

        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }

        req.signal.removeEventListener("abort", onAbort);

        if (shouldCloseController) {
          try {
            controller.close();
          } catch {
            // ignore close errors
          }
        }
      };
      cancelStream = () => cleanup(false);

      const send = (data: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          console.warn("[SSE] Controller closed, stop sending");
          cleanup(false);
        }
      };

      const onAbort = () => {
        cleanup();
      };

      req.signal.addEventListener("abort", onAbort);
      if (req.signal.aborted) {
        cleanup(false);
        return;
      }

      send({ type: "connected", timestamp: Date.now() });

      const pool = getSubscriptionPool();
      try {
        unsubscribe = await pool.subscribe(
          userId,
          (message) => {
            send({
              type: "event",
              eventId: message.eventId,
              eventType: message.type,
              status: message.status ?? "processing",
              payload: message.payload ?? null,
              updatedAt: message.timestamp,
            });
          },
          subscriptionKey
        );
      } catch (error) {
        console.error("[SSE] Failed to subscribe user stream:", error);
        send({
          type: "degraded",
          reason: "redis_unavailable",
          timestamp: Date.now(),
        });
      }

      if (req.signal.aborted) {
        cleanup(false);
        return;
      }

      heartbeat = setInterval(() => {
        send({ type: "heartbeat", timestamp: Date.now() });
      }, 15000);
    },
    cancel() {
      cancelStream?.();
      cancelStream = null;
      return;
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
