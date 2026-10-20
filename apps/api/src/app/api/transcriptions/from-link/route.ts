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
import { createAnonymousTranscriptionAccessToken } from "@markless/shared/src/lib/transcriptions/tokens";
import {
  confirmFreeTranscriptionUsageReservation,
  getFreeTranscriptionDurationLimitMs,
  reserveFreeTranscriptionUsage,
  rollbackFreeTranscriptionUsageReservation,
} from "@markless/shared/src/lib/transcriptions/free-usage";
import {
  completeTranscriptionJobFromYouTubeCaptions,
  createTranscriptionJob,
  getTranscriptionJobByPublicId,
  processTranscriptionJob,
  updateTranscriptionJob,
} from "@markless/server/src/lib/transcriptions/service";
import { importLinkMediaToR2 } from "@markless/server/src/lib/transcriptions/link-importer";
import { CreditService } from "@markless/server/src/lib/credits/service";
import {
  buildTranscriptionChargeIdempotencyKey,
  buildTranscriptionRefundIdempotencyKey,
  calculateTranscriptionCredits,
} from "@markless/shared/src/lib/transcriptions/billing";
import {
  isYouTubeUrl,
  resolveYouTubeCaptionTranscript,
  validateIncomingLink,
} from "@markless/shared/src/lib/transcriptions/link-media";
import { verifyTranscriptionLinkPreviewToken } from "@markless/shared/src/lib/transcriptions/tokens";
import { API_ERROR_CODES } from "@markless/shared/src/types/api/video";
import {
  resolveTranscriptionAccessPolicy,
  usesPaidMinutesBilling,
} from "@markless/server/src/lib/transcriptions/access-policy";
import {
  isHeroUploadAudioLanguageId,
  resolveRequestedTranscriptionLanguage,
} from "@markless/shared/src/i18n/data/hero-upload-audio-languages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type CreateTranscriptionFromLinkRequest = {
  url?: string;
  previewToken?: string;
  audioLanguage?: string;
  aiSummary?: "off" | "general";
  aiMindMap?: "off" | "general";
};

type AsyncLinkImportInput = {
  publicId: string;
  url: string;
  ownerId: string;
  userId: string | null;
  previewTitle: string | null;
  previewDurationMs: number | null;
  requiredCredits: number;
  creditsCharged: boolean;
  chargedBreakdown: { subscription: number; bonus: number; purchased: number } | null;
  durationLimitMs: number | null;
  reservation: Awaited<ReturnType<typeof reserveFreeTranscriptionUsage>> | null;
  requestedLanguage: string | null;
};

function generateReservationPublicId(): string {
  return `${Date.now()}${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`;
}

function buildPendingSourceFileName(title: string): string {
  const normalized = title.replace(/\s+/g, " ").trim();
  return `${normalized || "Untitled media"}.mp3`;
}

function normalizeProcessedDurationFields(
  sourceDurationMs: number | null | undefined,
  durationLimitMs: number | null | undefined
): {
  sourceDurationMs: number | null;
  processedDurationMs: number | null;
  durationLimitMs: number | null;
  wasDurationTrimmed: boolean;
} {
  const normalizedLimit =
    typeof durationLimitMs === "number" && Number.isFinite(durationLimitMs) && durationLimitMs > 0
      ? Math.round(durationLimitMs)
      : null;
  const normalizedSource =
    typeof sourceDurationMs === "number" && Number.isFinite(sourceDurationMs) && sourceDurationMs > 0
      ? Math.round(sourceDurationMs)
      : null;

  if (!normalizedLimit) {
    return {
      sourceDurationMs: normalizedSource,
      processedDurationMs: normalizedSource,
      durationLimitMs: null,
      wasDurationTrimmed: false,
    };
  }

  if (!normalizedSource) {
    return {
      sourceDurationMs: null,
      processedDurationMs: normalizedLimit,
      durationLimitMs: normalizedLimit,
      wasDurationTrimmed: false,
    };
  }

  return {
    sourceDurationMs: normalizedSource,
    processedDurationMs: Math.min(normalizedSource, normalizedLimit),
    durationLimitMs: normalizedLimit,
    wasDurationTrimmed: normalizedSource > normalizedLimit,
  };
}

async function refundLinkCreationCredits(input: {
  userId: string;
  publicId: string;
  requiredCredits: number;
  chargedBreakdown?: { subscription: number; bonus: number; purchased: number } | null;
}): Promise<void> {
  await CreditService.refundCredits({
    userId: input.userId,
    amount: input.requiredCredits,
    description: "Transcription creation failed - credits refunded",
    metadata: {
      publicId: input.publicId,
      reason: "link_import_failed",
      ...(input.chargedBreakdown ? { breakdown: input.chargedBreakdown } : {}),
    },
    idempotencyKey: buildTranscriptionRefundIdempotencyKey(input.publicId),
  }).catch(() => undefined);
}

async function processLinkImportAsync(input: AsyncLinkImportInput): Promise<void> {
  const asyncImportStartedAt = Date.now();
  try {
    console.info("[Transcriptions][From Link] Async import started", {
      publicId: input.publicId,
      hasUserId: Boolean(input.userId),
      previewTitle: input.previewTitle,
      previewDurationMs: input.previewDurationMs,
      requiredCredits: input.requiredCredits,
      creditsCharged: input.creditsCharged,
      hasFreeReservation: Boolean(input.reservation),
      clipFirstEligible: input.durationLimitMs !== null,
    });

    await updateTranscriptionJob(input.publicId, {
      status: "preprocessing",
      stage: "importing_media",
      statusMessage: null,
      errorCode: null,
      errorMessage: null,
      completedAt: null,
    });

    const captionResolveStartedAt = Date.now();
    const youtubeCaptionTranscript = isYouTubeUrl(input.url)
      ? await resolveYouTubeCaptionTranscript(
          input.url,
          input.requestedLanguage
        ).catch((error) => {
          console.warn(
            "[Transcriptions][From Link] YouTube captions unavailable, falling back to AI:",
            error
          );
          return null;
        })
      : null;
    const captionResolveElapsedMs = Date.now() - captionResolveStartedAt;

    if (youtubeCaptionTranscript) {
      console.info("[Transcriptions][From Link] YouTube captions hit", {
        publicId: input.publicId,
        transcriptSource: youtubeCaptionTranscript.source,
        language: youtubeCaptionTranscript.language,
        durationMs: youtubeCaptionTranscript.durationMs,
        segmentCount: youtubeCaptionTranscript.segments.length,
        captionResolveElapsedMs,
      });

      await completeTranscriptionJobFromYouTubeCaptions({
        publicId: input.publicId,
        transcriptSource: youtubeCaptionTranscript.source,
        language: youtubeCaptionTranscript.language,
        durationMs: youtubeCaptionTranscript.durationMs,
        segments: youtubeCaptionTranscript.segments,
      });
      return;
    }

    console.info("[Transcriptions][From Link] Falling back to AI transcription", {
      publicId: input.publicId,
      reason: isYouTubeUrl(input.url) ? "youtube_captions_unavailable" : "non_youtube_source",
      clipFirstEligible: input.durationLimitMs !== null,
      captionResolveElapsedMs,
    });

    const importAndSubmitStartedAt = Date.now();
    const importedMedia = await importLinkMediaToR2({
      url: input.url,
      publicId: input.publicId,
      ownerId: input.ownerId,
      previewTitle: input.previewTitle,
      previewDurationMs: input.previewDurationMs,
      maxDurationSeconds: input.durationLimitMs ? input.durationLimitMs / 1000 : undefined,
      onUploadStart: async () => {
        await updateTranscriptionJob(input.publicId, {
          status: "preprocessing",
          stage: "uploading_source",
          statusMessage: null,
        });
      },
    });

    console.info("[Transcriptions][From Link] Imported media ready", {
      publicId: input.publicId,
      sourceType: importedMedia.sourceType,
      fileName: importedMedia.fileName,
      contentType: importedMedia.contentType,
      fileSizeBytes: importedMedia.fileSizeBytes,
      titleSource: importedMedia.titleSource,
      previewDurationMs: input.previewDurationMs,
      originalDurationMs: importedMedia.durationMs,
      clipFirstApplied: importedMedia.clippedForProcessing,
      sourceR2Key: importedMedia.sourceR2Key,
      title: importedMedia.title,
      importAndSubmitElapsedMs: Date.now() - importAndSubmitStartedAt,
    });

    const currentJob = await getTranscriptionJobByPublicId(input.publicId);
    if (!currentJob) {
      throw new Error(`Transcription job not found during link import: ${input.publicId}`);
    }

    await updateTranscriptionJob(input.publicId, {
      sourceType: importedMedia.sourceType,
      sourceFileName: importedMedia.fileName,
      sourceDisplayTitle: importedMedia.title,
      sourceContentType: importedMedia.contentType,
      sourceFileSize: Math.max(1, importedMedia.fileSizeBytes),
      sourceR2Key: importedMedia.sourceR2Key,
      sourceUrl: importedMedia.sourceUrl || input.url,
      ...(importedMedia.clippedForProcessing
        ? {
            sourceDurationMs: importedMedia.durationMs ?? currentJob.sourceDurationMs,
            processedDurationMs: currentJob.durationLimitMs,
            durationLimitMs: currentJob.durationLimitMs,
            wasDurationTrimmed: true,
          }
        : normalizeProcessedDurationFields(
            importedMedia.durationMs ?? currentJob.sourceDurationMs,
            currentJob.durationLimitMs
          )),
    });

    await processTranscriptionJob(input.publicId);

    console.info("[Transcriptions][From Link] Async import finished", {
      publicId: input.publicId,
      totalAsyncImportElapsedMs: Date.now() - asyncImportStartedAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to import media from link";

    console.error("[Transcriptions][From Link] Async import failed:", error);

    if (input.reservation) {
      await rollbackFreeTranscriptionUsageReservation(input.reservation).catch(() => undefined);
    }

    if (input.userId && input.creditsCharged) {
      await refundLinkCreationCredits({
        userId: input.userId,
        publicId: input.publicId,
        requiredCredits: input.requiredCredits,
        chargedBreakdown: input.chargedBreakdown,
      });
    }

    await updateTranscriptionJob(input.publicId, {
      status: "failed",
      stage: "failed",
      statusMessage: null,
      errorCode: "LINK_IMPORT_FAILED",
      errorMessage: message,
      completedAt: new Date(),
    }).catch(() => undefined);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id ?? null;
  const browserAnonymousSessionId =
    getAnonymousTranscriptionSessionId(request) || createAnonymousTranscriptionSessionId();

  const body = (await request.json().catch(() => ({}))) as CreateTranscriptionFromLinkRequest;
  const url = String(body.url || "").trim();
  const previewToken = String(body.previewToken || "").trim();
  const audioLanguage = String(body.audioLanguage || "auto").trim().toLowerCase();
  const aiSummary = String(body.aiSummary || "off").trim();
  const aiMindMap = String(body.aiMindMap || "off").trim();

  if (!url) {
    return validationErrorResponse("url is required");
  }

  if (!previewToken) {
    return validationErrorResponse("previewToken is required");
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

  const anonymousSessionId = userId ? null : browserAnonymousSessionId;
  const reservationPublicId = generateReservationPublicId();
  let reservation: Awaited<ReturnType<typeof reserveFreeTranscriptionUsage>> | null = null;
  let creditsCharged = false;
  let chargedBreakdown: { subscription: number; bonus: number; purchased: number } | null = null;
  let requiredCredits = 0;
  let durationLimitMs: number | null = null;

  try {
    const ownerId = userId ? `user_${userId}` : `anon_${browserAnonymousSessionId}`;
    const normalizedUrl = validateIncomingLink(url);
    const previewVerification = verifyTranscriptionLinkPreviewToken(previewToken);

    if (!previewVerification.valid || !previewVerification.payload) {
      return errorResponse(
        API_ERROR_CODES.INVALID_PARAMS,
        "The link preview expired. Please try again.",
        400
      );
    }

    const preview = previewVerification.payload;

    console.info("[Transcriptions][From Link] Preview confirmed", {
      requestUrl: normalizedUrl,
      sourceType: preview.sourceType,
      durationMs: preview.durationMs,
      status: preview.status,
      hasUserId: Boolean(userId),
    });

    if (preview.requestUrl !== normalizedUrl) {
      return errorResponse(
        API_ERROR_CODES.INVALID_PARAMS,
        "The link preview does not match this URL. Please try again.",
        400
      );
    }

    if (preview.status === "preview_only") {
      return errorResponse(
        API_ERROR_CODES.LINK_MEDIA_IMPORT_FAILED,
        "We found this link, but couldn't import the media reliably. Please try again or upload the file directly.",
        422
      );
    }

    const accessPolicy = await resolveTranscriptionAccessPolicy(userId);
    durationLimitMs = usesPaidMinutesBilling(accessPolicy)
      ? null
      : getFreeTranscriptionDurationLimitMs(accessPolicy.accessMode);

    if (usesPaidMinutesBilling(accessPolicy)) {
      requiredCredits = calculateTranscriptionCredits(preview.durationMs);
    }

    if (!usesPaidMinutesBilling(accessPolicy)) {
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
            sourceType: preview.sourceType,
            durationMs: preview.durationMs,
            sourceUrl: preview.canonicalUrl,
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

    const job = await createTranscriptionJob({
      publicId: reservationPublicId,
      userId,
      anonymousSessionId,
      sourceType: "audio",
      fileName: buildPendingSourceFileName(preview.title),
      displayTitle: preview.title,
      transcriptSource: "ai_transcription",
      contentType: "audio/mpeg",
      fileSize: 1,
      durationMs: preview.durationMs ?? null,
      durationLimitMs,
      requestedLanguage,
      summaryTemplateKey: aiSummary,
      mindMapTemplateKey: aiMindMap,
      sourceR2Key: "",
      sourceUrl: preview.canonicalUrl,
    });

    console.info("[Transcriptions][From Link] Job created", {
      publicId: job.publicId,
      hasUserId: Boolean(userId),
      requiredCredits,
      creditsCharged,
      hasFreeReservation: Boolean(reservation),
      previewTitle: preview.title,
      previewSourceType: preview.sourceType,
      previewDurationMs: preview.durationMs,
      durationLimitMs,
      transcriptSource: "ai_transcription",
    });

    if (reservation) {
      await confirmFreeTranscriptionUsageReservation(reservation);
    }

    after(async () => {
      await processLinkImportAsync({
        publicId: job.publicId,
        url: normalizedUrl,
        ownerId,
        userId,
        previewTitle: preview.title,
        previewDurationMs: preview.durationMs ?? null,
        requiredCredits,
        creditsCharged,
        chargedBreakdown,
        durationLimitMs,
        requestedLanguage,
        reservation,
      });
    });

    const response = successResponse({
      jobId: job.id,
      publicId: job.publicId,
      resultUrl: `/transcriptions/${job.publicId}`,
      displayTitle: preview.title,
      anonymousAccessToken:
        anonymousSessionId
          ? createAnonymousTranscriptionAccessToken(job.publicId, anonymousSessionId)
          : null,
    });

    setAnonymousTranscriptionSessionCookie(response, browserAnonymousSessionId);
    return response;
  } catch (error) {
    if (reservation) {
      await rollbackFreeTranscriptionUsageReservation(reservation);
    }
    if (creditsCharged && userId) {
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
      }).catch(() => undefined);
    }
    const message =
      error instanceof Error ? error.message : "Failed to create the transcription task.";
    console.error("[Transcriptions][From Link] Failed:", error);
    const isInputError =
      message === "Link is required" ||
      message === "Please enter a valid media link" ||
      message.includes("Link is invalid") ||
      message.includes("Link must use http or https") ||
      message.includes("Link host is not allowed");
    const isImportDownloadError =
      message.includes("yt-dlp media download failed") ||
      message.includes("download failed to produce a media file");
    const isImportUploadError =
      message.includes("Failed to upload file to R2");

    if (isImportDownloadError) {
      return errorResponse(
        API_ERROR_CODES.LINK_MEDIA_DOWNLOAD_FAILED,
        "We found the video, but couldn't import it reliably. Please try again or upload the file directly.",
        422
      );
    }

    if (isImportUploadError) {
      return errorResponse(
        API_ERROR_CODES.LINK_MEDIA_UPLOAD_FAILED,
        "We found the video, but couldn't store it right now. Please try again in a moment.",
        502
      );
    }

    return errorResponse(
      isInputError ? API_ERROR_CODES.INVALID_PARAMS : API_ERROR_CODES.INTERNAL_ERROR,
      message,
      isInputError ? 400 : 500
    );
  }
}
