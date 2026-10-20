import { NextRequest } from "next/server";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@markless/shared/src/lib/api/response";
import { authorizeTranscriptionRead } from "@markless/server/src/lib/transcriptions/access";
import {
  bulkRenameTranscriptionSpeakersByLabel,
  serializeTranscriptionJob,
} from "@markless/server/src/lib/transcriptions/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type BulkRenameSpeakersRequest = {
  matchLabel?: string;
  displayName?: string;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const access = await authorizeTranscriptionRead(request, id);

  if ("reason" in access) {
    return errorResponse(
      access.reason === "not_found" ? "INVALID_PARAMS" : "FORBIDDEN",
      access.reason === "not_found" ? "Transcription not found" : "Access denied",
      access.reason === "not_found" ? 404 : 403
    );
  }

  const body = (await request.json().catch(() => ({}))) as BulkRenameSpeakersRequest;
  const matchLabel = String(body.matchLabel ?? "").trim();
  const displayName = String(body.displayName ?? "").trim();

  if (!matchLabel) {
    return validationErrorResponse("matchLabel is required");
  }

  if (!displayName) {
    return validationErrorResponse("displayName is required");
  }

  try {
    const job = await bulkRenameTranscriptionSpeakersByLabel(id, matchLabel, displayName);

    if (!job) {
      return errorResponse("INVALID_PARAMS", "No matching speakers found", 404);
    }

    return successResponse({
      task: await serializeTranscriptionJob(job),
    });
  } catch (error) {
    return validationErrorResponse(
      error instanceof Error ? error.message : "Failed to rename speakers"
    );
  }
}
