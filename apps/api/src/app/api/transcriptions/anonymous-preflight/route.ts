import { NextRequest } from "next/server";
import {
  errorResponse,
  successResponse,
} from "@markless/shared/src/lib/api/response";
import {
  createAnonymousTranscriptionSessionId,
  getAnonymousTranscriptionSessionId,
  setAnonymousTranscriptionSessionCookie,
} from "@markless/shared/src/lib/transcriptions/anonymous-session";
import {
  getFreeTranscriptionConfig,
  getFreeTranscriptionUsageAvailability,
} from "@markless/shared/src/lib/transcriptions/free-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const anonymousSessionId =
    getAnonymousTranscriptionSessionId(request) || createAnonymousTranscriptionSessionId();

  const availability = await getFreeTranscriptionUsageAvailability({
    anonymousSessionId,
    dailyLimit: getFreeTranscriptionConfig("anonymous").dailyLimit,
  });

  if (!availability.allowed) {
    const response = errorResponse(
      "ANONYMOUS_CREDITS_EXHAUSTED",
      "Daily free transcription limit reached",
      429,
      {
        used: availability.used,
        limit: availability.limit,
        remainingCount: 0,
      }
    );

    setAnonymousTranscriptionSessionCookie(response, anonymousSessionId);
    return response;
  }

  const response = successResponse({
    allowed: true,
    used: availability.used,
    limit: availability.limit,
    remainingCount: availability.remaining,
  });

  setAnonymousTranscriptionSessionCookie(response, anonymousSessionId);
  return response;
}
