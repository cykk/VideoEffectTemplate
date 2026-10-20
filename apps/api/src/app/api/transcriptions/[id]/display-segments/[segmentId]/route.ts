import { NextRequest } from "next/server";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@markless/shared/src/lib/api/response";
import { authorizeTranscriptionRead } from "@markless/server/src/lib/transcriptions/access";
import {
  serializeTranscriptionJob,
  updateTranscriptionDisplaySegmentSpeakerOverride,
  updateTranscriptionDisplaySegmentText,
} from "@markless/server/src/lib/transcriptions/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
    segmentId: string;
  }>;
};

type UpdateDisplaySegmentRequest = {
  text?: string;
  speakerLabelOverride?: string | null;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id, segmentId } = await context.params;
  const access = await authorizeTranscriptionRead(request, id);

  if ("reason" in access) {
    return errorResponse(
      access.reason === "not_found" ? "INVALID_PARAMS" : "FORBIDDEN",
      access.reason === "not_found" ? "Transcription not found" : "Access denied",
      access.reason === "not_found" ? 404 : 403
    );
  }

  const body = (await request.json().catch(() => ({}))) as UpdateDisplaySegmentRequest;

  if (body.text === undefined && body.speakerLabelOverride === undefined) {
    return validationErrorResponse("text or speakerLabelOverride is required");
  }

  try {
    let job = null;

    if (body.speakerLabelOverride !== undefined) {
      job = await updateTranscriptionDisplaySegmentSpeakerOverride(
        id,
        segmentId,
        body.speakerLabelOverride
      );
    } else if (body.text !== undefined) {
      const text = String(body.text || "").trim();
      if (!text) {
        return validationErrorResponse("text is required");
      }
      job = await updateTranscriptionDisplaySegmentText(id, segmentId, text);
    }

    if (!job) {
      return errorResponse("INVALID_PARAMS", "Display segment not found", 404);
    }

    return successResponse({
      task: await serializeTranscriptionJob(job),
    });
  } catch (error) {
    return validationErrorResponse(
      error instanceof Error ? error.message : "Failed to update display segment"
    );
  }
}
