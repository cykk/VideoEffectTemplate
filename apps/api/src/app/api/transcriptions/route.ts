import { after, NextRequest } from "next/server";
import { auth } from "@markless/server/src/lib/auth/server";
import {
  errorResponse,
  insufficientCreditsResponse,
  successResponse,
  validationErrorResponse,
} from "@markless/shared/src/lib/api/response";
import {
  createAnonymousTranscriptionSessionId,
  getAnonymousTranscriptionSessionId,
  setAnonymousTranscriptionSessionCookie,
} from "@markless/shared/src/lib/transcriptions/anonymous-session";
import {
  createAnonymousTranscriptionAccessToken,
} from "@markless/shared/src/lib/transcriptions/tokens";
import {
  confirmFreeTranscriptionUsageReservation,
  getFreeTranscriptionDurationLimitMs,
  reserveFreeTranscriptionUsage,
  rollbackFreeTranscriptionUsageReservation,
} from "@markless/shared/src/lib/transcriptions/free-usage";
import {
  createTranscriptionJob,
  processTranscriptionJob,
} from "@markless/server/src/lib/transcriptions/service";
import {
  headR2Object,
  resolveR2ObjectUrl,
} from "@markless/server/src/lib/storage/r2-storage";
import { CreditService } from "@markless/server/src/lib/credits/service";
import {
  buildTranscriptionChargeIdempotencyKey,
  buildTranscriptionRefundIdempotencyKey,
  calculateVerifiedTranscriptionCredits,
} from "@markless/shared/src/lib/transcriptions/billing";
import {
  resolveSupportedTranscriptionUploadContentType,
} from "@markless/shared/src/lib/transcriptions/media-formats";
import { getTranscriptionUploadMaxFileBytes } from "@markless/shared/src/lib/transcriptions/upload-limits";
import {
  resolveTranscriptionAccessPolicy,
  usesPaidMinutesBilling,
} from "@markless/server/src/lib/transcriptions/access-policy";
import { recordTranscriptionUploadFailure } from "@markless/server/src/lib/transcriptions/upload-failure";
import {
  isHeroUploadAudioLanguageId,
  resolveRequestedTranscriptionLanguage,
} from "@markless/shared/src/i18n/data/hero-upload-audio-languages";
import {
  BillableMediaVerificationError,
  verifyBillableMediaFromR2,
} from "@markless/server/src/lib/transcriptions/billing-metering";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function generateReservationPublicId(): string {
  return `${Date.now()}${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`;
}

type CreateTranscriptionRequest = {
  sourceType?: "audio" | "video";
  aiSummary?: "off" | "general";
  aiMindMap?: "off" | "general";
  audioLanguage?: string;
  fileName?: string;
  contentType?: string;
  durationMs?: number | null;
  sourceKey?: string;
};

function isValidSourceType(value: string): value is "audio" | "video" {
  return value === "audio" || value === "video";
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id ?? null;
  const browserAnonymousSessionId =
    getAnonymousTranscriptionSessionId(request) || createAnonymousTranscriptionSessionId();

  const requestId = request.headers.get("x-request-id");
  const body = (await request.json().catch(() => ({}))) as CreateTranscriptionRequest;
  const sourceType = String(body.sourceType || "").trim();
  const aiSummary = String(body.aiSummary || "off").trim();
  const aiMindMap = String(body.aiMindMap || "off").trim();
  const audioLanguage = String(body.audioLanguage || "auto").trim().toLowerCase();
  const fileName = String(body.fileName || "").trim();
  const contentType = String(body.contentType || "").trim();
  const sourceKey = String(body.sourceKey || "").trim();
  const clientDurationMs =
    body.durationMs === null || body.durationMs === undefined
      ? null
      : Number(body.durationMs);

  if (!isValidSourceType(sourceType)) {
    await recordTranscriptionUploadFailure({ requestId, userId, anonymousSessionId: browserAnonymousSessionId, sourceType, fileName, contentType, failureStage: "validation", errorCode: "INVALID_PARAMS", errorMessage: "sourceType is invalid" });
    return validationErrorResponse("sourceType is invalid");
  }

  if (aiSummary !== "off" && aiSummary !== "general") {
    return validationErrorResponse("aiSummary is invalid");
  }

  if (aiMindMap !== "off" && aiMindMap !== "general") {
    return validationErrorResponse("aiMindMap is invalid");
  }

  if (!isHeroUploadAudioLanguageId(audioLanguage)) {
    return validationErrorResponse("audioLanguage is invalid");
  }
  const requestedLanguage = resolveRequestedTranscriptionLanguage(audioLanguage);

  if (!fileName || !contentType || !sourceKey) {
    await recordTranscriptionUploadFailure({ requestId, userId, anonymousSessionId: browserAnonymousSessionId, sourceType, fileName, contentType, failureStage: "validation", errorCode: "INVALID_PARAMS", errorMessage: "fileName, contentType and sourceKey are required" });
    return validationErrorResponse(
      "fileName, contentType and sourceKey are required"
    );
  }

  const normalizedContentType = resolveSupportedTranscriptionUploadContentType({
    sourceType,
    fileName,
    contentType,
  });
  if (!normalizedContentType) {
    await recordTranscriptionUploadFailure({ requestId, userId, anonymousSessionId: browserAnonymousSessionId, sourceType, fileName, contentType, failureStage: "file_validation", errorCode: "UNSUPPORTED_FILE_TYPE", errorMessage: "Unsupported file type" });
    return validationErrorResponse("Unsupported file type");
  }

  const anonymousSessionId = userId ? null : browserAnonymousSessionId;
  const ownerId = userId ? `user_${userId}` : `anon_${anonymousSessionId}`;
  const sourceKeyPrefix = `private/transcriptions/${ownerId}/source/`;
  if (!sourceKey.startsWith(sourceKeyPrefix)) {
    await recordTranscriptionUploadFailure({ requestId, userId, anonymousSessionId: browserAnonymousSessionId, sourceType, fileName, contentType, failureStage: "validation", errorCode: "INVALID_PARAMS", errorMessage: "sourceKey is invalid" });
    return validationErrorResponse("sourceKey is invalid");
  }

  const sourceMetadata = await headR2Object(sourceKey);
  if (!sourceMetadata.contentLength) {
    await recordTranscriptionUploadFailure({ requestId, userId, anonymousSessionId: browserAnonymousSessionId, sourceType, fileName, contentType, failureStage: "file_validation", errorCode: "INVALID_PARAMS", errorMessage: "Uploaded source file is unavailable" });
    return validationErrorResponse("Uploaded source file is unavailable");
  }
  if (sourceMetadata.contentType?.trim().toLowerCase() !== normalizedContentType) {
    await recordTranscriptionUploadFailure({ requestId, userId, anonymousSessionId: browserAnonymousSessionId, sourceType, fileName, contentType, fileSize: sourceMetadata.contentLength, failureStage: "file_validation", errorCode: "UNSUPPORTED_FILE_TYPE", errorMessage: "Uploaded source file type is invalid" });
    return validationErrorResponse("Uploaded source file type is invalid");
  }

  const maxFileSizeBytes = getTranscriptionUploadMaxFileBytes({
    accessMode: userId ? "authenticated" : "anonymous",
    sourceType,
  });
  if (sourceMetadata.contentLength > maxFileSizeBytes) {
    await recordTranscriptionUploadFailure({ requestId, userId, anonymousSessionId: browserAnonymousSessionId, sourceType, fileName, contentType, fileSize: sourceMetadata.contentLength, failureStage: "file_validation", errorCode: "FILE_TOO_LARGE", errorMessage: "Uploaded file exceeds the allowed size" });
    return errorResponse(
      "UPLOAD_FILE_TOO_LARGE",
      "Uploaded file exceeds the allowed size",
      413,
      { maxFileSizeBytes }
    );
  }

  const reservationPublicId = generateReservationPublicId();
  const accessPolicy = await resolveTranscriptionAccessPolicy(userId);
  const isPaidMinutesBilling = usesPaidMinutesBilling(accessPolicy);

  let verifiedDurationMs: number | null = null;
  let verifiedMedia: Awaited<ReturnType<typeof verifyBillableMediaFromR2>> | null = null;
  if (isPaidMinutesBilling) {
    try {
      verifiedMedia = await verifyBillableMediaFromR2({
        sourceKey,
        contentType: normalizedContentType,
      });
      verifiedDurationMs = verifiedMedia.durationMs;
    } catch (error) {
      const verificationError = error instanceof BillableMediaVerificationError
        ? error
        : new BillableMediaVerificationError("The uploaded media could not be verified", { cause: error });
      await recordTranscriptionUploadFailure({
        requestId,
        userId,
        anonymousSessionId: browserAnonymousSessionId,
        sourceType,
        fileName,
        contentType,
        fileSize: sourceMetadata.contentLength,
        failureStage: "file_validation",
        errorCode: "MEDIA_VERIFICATION_FAILED",
        errorMessage: verificationError.message,
      });
      return errorResponse(
        "INVALID_PARAMS",
        "We couldn't verify the uploaded media. Please upload a file with a readable audio track and try again.",
        422
      );
    }
  }

  const verifiedSourceUrl = await resolveR2ObjectUrl(sourceKey);
  const requiredCredits = isPaidMinutesBilling
    ? calculateVerifiedTranscriptionCredits(verifiedDurationMs!)
    : 0;

  let reservation: Awaited<ReturnType<typeof reserveFreeTranscriptionUsage>> | null = null;
  let creditsCharged = false;
  let chargedBreakdown: { subscription: number; bonus: number; purchased: number } | null = null;

  if (!isPaidMinutesBilling) {
    reservation = await reserveFreeTranscriptionUsage({
      userId,
      anonymousSessionId: browserAnonymousSessionId,
      publicId: reservationPublicId,
      dailyLimit: accessPolicy.free.dailyLimit,
    });

    if (!reservation) {
      const response = errorResponse(
        "ANONYMOUS_CREDITS_EXHAUSTED",
        "Daily free transcription limit reached",
        429
      );

      setAnonymousTranscriptionSessionCookie(response, browserAnonymousSessionId);
      return response;
    }
  } else {
    try {
      const charge = await CreditService.deductCredits({
        userId,
        amount: requiredCredits,
        description: "Transcription job",
        metadata: {
          publicId: reservationPublicId,
          sourceType,
          clientDurationMs,
          verifiedDurationMs,
          durationSource: "server_ffprobe",
          calculatedCredits: requiredCredits,
          formatNames: verifiedMedia?.formatNames ?? [],
          audioCodec: verifiedMedia?.audioCodec ?? null,
        },
        idempotencyKey: buildTranscriptionChargeIdempotencyKey(reservationPublicId),
      });
      chargedBreakdown = charge.breakdown;
      creditsCharged = true;
    } catch (error) {
      const account = await CreditService.getOrCreateUserCredits(userId);
      const message = error instanceof Error ? error.message : "";
      if (message.includes("Insufficient credits")) {
        return insufficientCreditsResponse(requiredCredits, account.totalBalance);
      }
      throw error;
    }
  }

  let job;
  try {
    job = await createTranscriptionJob({
      publicId: reservationPublicId,
      userId,
      anonymousSessionId,
      sourceType,
      fileName,
      contentType: normalizedContentType,
      fileSize: sourceMetadata.contentLength,
      durationMs: verifiedDurationMs ?? clientDurationMs,
      durationLimitMs: isPaidMinutesBilling
        ? null
        : getFreeTranscriptionDurationLimitMs(accessPolicy.accessMode),
      requestedLanguage,
      summaryTemplateKey: aiSummary,
      mindMapTemplateKey: aiMindMap,
      sourceR2Key: sourceKey,
      sourceUrl: verifiedSourceUrl,
    });
    if (reservation) {
      await confirmFreeTranscriptionUsageReservation(reservation);
    }
  } catch (error) {
    if (reservation) {
      await rollbackFreeTranscriptionUsageReservation(reservation);
    }
    if (isPaidMinutesBilling && userId && creditsCharged) {
      await CreditService.refundCredits({
        userId,
        amount: requiredCredits,
        description: "Transcription creation failed - credits refunded",
        metadata: {
          publicId: reservationPublicId,
          reason: "create_failed",
          ...(chargedBreakdown ? { breakdown: chargedBreakdown } : {}),
        },
        idempotencyKey: buildTranscriptionRefundIdempotencyKey(reservationPublicId),
      });
    }
    throw error;
  }

  after(async () => {
    await processTranscriptionJob(job.publicId);
  });

  const response = successResponse({
    jobId: job.id,
    publicId: job.publicId,
    resultUrl: `/transcriptions/${job.publicId}`,
    anonymousAccessToken:
      anonymousSessionId
        ? createAnonymousTranscriptionAccessToken(job.publicId, anonymousSessionId)
        : null,
  });

  setAnonymousTranscriptionSessionCookie(response, browserAnonymousSessionId);

  return response;
}
