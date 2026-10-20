import { NextRequest } from "next/server";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@markless/shared/src/lib/api/response";
import { authorizeTranscriptionRead } from "@markless/server/src/lib/transcriptions/access";
import { saveTranscriptionFeedback } from "@markless/server/src/lib/transcriptions/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type SubmitTranscriptionFeedbackRequest = {
  rating?: number;
  feedbackText?: string;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const access = await authorizeTranscriptionRead(request, id);

  if ("reason" in access) {
    return errorResponse(
      access.reason === "not_found" ? "INVALID_PARAMS" : "FORBIDDEN",
      access.reason === "not_found" ? "Transcription not found" : "Access denied",
      access.reason === "not_found" ? 404 : 403
    );
  }

  const body = (await request.json().catch(() => ({}))) as SubmitTranscriptionFeedbackRequest;
  const rating = Number(body.rating);
  const feedbackText = String(body.feedbackText || "").trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return validationErrorResponse("rating must be an integer between 1 and 5");
  }

  if (rating <= 3 && !feedbackText) {
    return validationErrorResponse(
      "feedbackText is required when rating is 3 or below"
    );
  }

  await saveTranscriptionFeedback({
    publicId: access.job.publicId,
    userId: access.mode === "session" ? access.job.userId : null,
    anonymousSessionId:
      access.mode === "anonymous" ? access.job.anonymousSessionId : null,
    rating,
    feedbackText: feedbackText || null,
  });

  return successResponse({
    saved: true,
  });
}
