import { NextRequest } from "next/server";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@markless/shared/src/lib/api/response";
import { authorizeTranscriptionRead } from "@markless/server/src/lib/transcriptions/access";
import {
  renameTranscriptionSpeaker,
  serializeTranscriptionJob,
} from "@markless/server/src/lib/transcriptions/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
    speakerId: string;
  }>;
};

type RenameSpeakerRequest = {
  displayName?: string | null;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id, speakerId } = await context.params;
  const access = await authorizeTranscriptionRead(request, id);

  if ("reason" in access) {
    return errorResponse(
      access.reason === "not_found" ? "INVALID_PARAMS" : "FORBIDDEN",
      access.reason === "not_found" ? "Transcription not found" : "Access denied",
      access.reason === "not_found" ? 404 : 403
    );
  }

  const body = (await request.json().catch(() => ({}))) as RenameSpeakerRequest;
  const displayName =
    body.displayName === null || body.displayName === undefined
      ? null
      : String(body.displayName);

  try {
    const job = await renameTranscriptionSpeaker(id, speakerId, displayName);

    if (!job) {
      return errorResponse("INVALID_PARAMS", "Speaker not found", 404);
    }

    return successResponse({
      task: await serializeTranscriptionJob(job),
    });
  } catch (error) {
    return validationErrorResponse(
      error instanceof Error ? error.message : "Failed to rename speaker"
    );
  }
}
