import { NextRequest } from "next/server";
import { auth } from "@markless/server/src/lib/auth/server";
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "@markless/shared/src/lib/api/response";
import { CreditService } from "@markless/server/src/lib/credits/service";
import { calculateTranscriptionCredits } from "@markless/shared/src/lib/transcriptions/billing";
import { getAnonymousTranscriptionSessionId } from "@markless/shared/src/lib/transcriptions/anonymous-session";
import { getFreeTranscriptionUsageAvailability } from "@markless/shared/src/lib/transcriptions/free-usage";
import { resolveTranscriptionAccessPolicy } from "@markless/server/src/lib/transcriptions/access-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TranscriptionPreflightRequest = {
  durationMs?: number | null;
  sourceType?: "audio" | "video";
};

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id ?? null;

  if (!userId) {
    return unauthorizedResponse();
  }

  const body = (await request.json().catch(() => ({}))) as TranscriptionPreflightRequest;
  const sourceType = String(body.sourceType || "").trim();
  const durationMs =
    body.durationMs === null || body.durationMs === undefined
      ? null
      : Number(body.durationMs);

  if (sourceType !== "audio" && sourceType !== "video") {
    return validationErrorResponse("sourceType is invalid");
  }

  const accessPolicy = await resolveTranscriptionAccessPolicy(userId);
  if (accessPolicy.billingMode === "free") {
    const availability = await getFreeTranscriptionUsageAvailability({
      userId,
      anonymousSessionId: getAnonymousTranscriptionSessionId(request),
      dailyLimit: accessPolicy.free.dailyLimit,
    });
    return successResponse({
      allowed: availability.allowed,
      requiredCredits: 0,
      availableCredits: 0,
      used: availability.used,
      limit: availability.limit,
      remainingCount: availability.remaining,
      durationLimitMinutes: accessPolicy.free.durationLimitMinutes,
    });
  }

  const requiredCredits = calculateTranscriptionCredits(durationMs);
  const account = await CreditService.getOrCreateUserCredits(userId);

  return successResponse({
    allowed: account.totalBalance >= requiredCredits,
    requiredCredits,
    availableCredits: account.totalBalance,
  });
}
