import { randomInt } from "crypto";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@markless/server/src/lib/db";
import type { DrizzleClient } from "@markless/server/src/lib/db/client";
import { users } from "@markless/server/src/lib/db/schema/users";
import {
  transcriptionDisplaySegments,
  transcriptionFeedback,
  transcriptionFailureArchives,
  transcriptionJobs,
  transcriptionSpeakers,
  type NewTranscriptionFeedback,
  type NewTranscriptionJob,
  type TranscriptionDisplaySegment as DbTranscriptionDisplaySegment,
  type TranscriptionJob,
  type TranscriptionSpeaker as DbTranscriptionSpeaker,
} from "@markless/server/src/lib/db/schema/transcriptions";
import { serializeTranscriptionAiArtifacts } from "@markless/server/src/lib/transcriptions/ai-artifacts";
import { serializeTranscriptionTranslations } from "@markless/server/src/lib/transcriptions/translations";
import {
  uploadToR2,
  resolveR2ObjectUrl,
  downloadFromR2,
  getPresignedDownloadUrl,
  generateTranscriptionDerivedAudioKey,
  generateTranscriptionRawOutputKey,
  deleteFromR2,
} from "@markless/server/src/lib/storage/r2-storage";
import {
  prepareAudioBufferForTranscription,
  probeMediaUrlForTranscription,
} from "@markless/server/src/lib/ffmpeg/video-utils";
import { requestReplicatePrediction } from "@markless/server/src/lib/replicate/request";
import { CreditService } from "@markless/server/src/lib/credits/service";
import { buildWebhookUrl } from "@markless/shared/src/lib/config/urls";
import { getEnv } from "@markless/shared/src/lib/config/env";
import { createTranscriptionWebhookToken } from "@markless/shared/src/lib/transcriptions/tokens";
import {
  buildTranscriptionChargeIdempotencyKey,
  buildTranscriptionRefundIdempotencyKey,
  calculateTranscriptionCredits,
} from "@markless/shared/src/lib/transcriptions/billing";
import { normalizeReplicateTranscriptionOutput } from "@markless/shared/src/lib/transcriptions/normalize-output";
import {
  buildTranscriptionDisplayProjection,
  type GeneratedTranscriptionDisplayProjection,
} from "@markless/shared/src/lib/transcriptions/display-model";
import {
  coerceTranscriptionSegments,
} from "@markless/shared/src/lib/transcriptions/segment-aggregation";
import { publishTranscriptionRealtimeUpdate } from "@markless/shared/src/lib/transcriptions/events";
import { ANONYMOUS_TRANSCRIPTION_RETENTION_MS } from "@markless/shared/src/lib/transcriptions/anonymous-retention";
import { validateTranscriptionDisplayTitle } from "@markless/shared/src/lib/transcriptions/display-title";
import {
  getSpeakerEffectiveLabel,
  validateSpeakerDisplayName,
} from "@markless/shared/src/lib/transcriptions/speaker-display-name";
import type { AdminTranscriptionListItem } from "@markless/shared/src/lib/transcriptions/admin-list";
import { archiveTranscriptionFailure } from "@markless/server/src/lib/transcriptions/failure-archive";
import type {
  TranscriptionDisplaySegment,
  TranscriptionAiMindMapTemplateKey,
  TranscriptionJobClientData,
  TranscriptionReadResponse,
  TranscriptionSegment,
  TranscriptionSpeakerClientData,
  TranscriptionStage,
  TranscriptionSourceType,
  TranscriptionStatus,
  TranscriptionAiSummaryTemplateKey,
  TranscriptionTranscriptSource,
} from "@markless/shared/src/types/transcriptions";

type CreateTranscriptionJobInput = {
  publicId?: string;
  userId?: string | null;
  anonymousSessionId?: string | null;
  sourceType: TranscriptionSourceType;
  fileName: string;
  displayTitle?: string | null;
  transcriptSource?: TranscriptionTranscriptSource | null;
  contentType: string;
  fileSize: number;
  durationMs?: number | null;
  durationLimitMs?: number | null;
  requestedLanguage?: string | null;
  summaryTemplateKey?: TranscriptionAiSummaryTemplateKey;
  mindMapTemplateKey?: TranscriptionAiMindMapTemplateKey;
  sourceR2Key: string;
  sourceUrl: string;
};

type ReplicatePredictionResponse = {
  id: string;
  status: string;
  version?: string;
  output?: unknown;
  error?: string | null;
};

type DbTransaction = Parameters<Parameters<DrizzleClient["transaction"]>[0]>[0];

type SearchReplaceOptions = {
  search: string;
  replace: string;
  matchCase?: boolean;
  wholeWord?: boolean;
};

type SaveTranscriptionFeedbackInput = {
  publicId: string;
  userId?: string | null;
  anonymousSessionId?: string | null;
  rating: number;
  feedbackText?: string | null;
};

const REMOTE_MEDIA_DOWNLOAD_TIMEOUT_MS = 120000;
const REPLICATE_INPUT_URL_EXPIRES_IN_SECONDS = 60 * 60;
const TRANSCRIPTION_DERIVED_AUDIO_CONTENT_TYPE = "audio/flac";
const TRANSCRIPTION_DERIVED_AUDIO_EXTENSION = "flac";
function isPaidTranscriptionJob(job: TranscriptionJob): boolean {
  return Boolean(job.userId && job.durationLimitMs === null);
}

export function isTranscriptionJobExpired(
  job: Pick<TranscriptionJob, "userId" | "anonymousSessionId" | "expiresAt">
): boolean {
  if (job.userId) {
    return false;
  }

  if (!job.anonymousSessionId || !job.expiresAt) {
    return false;
  }

  return job.expiresAt.getTime() <= Date.now();
}

async function refundTranscriptionCreditsIfNeeded(
  job: TranscriptionJob,
  reason: "processing_failed" | "transcription_failed"
): Promise<void> {
  if (!isPaidTranscriptionJob(job) || !job.userId) {
    return;
  }

  const charge = await CreditService.getTransactionByIdempotencyKey(
    buildTranscriptionChargeIdempotencyKey(job.publicId)
  );
  const amount = charge ? Math.abs(charge.amount) : calculateTranscriptionCredits(job.sourceDurationMs ?? null);
  const breakdown = charge ? CreditService.extractBreakdown(charge.metadata) : null;

  await CreditService.refundCredits({
    userId: job.userId,
    amount,
    description: "Transcription failed - credits refunded",
    metadata: {
      publicId: job.publicId,
      reason,
      ...(breakdown ? { breakdown } : {}),
    },
    idempotencyKey: buildTranscriptionRefundIdempotencyKey(job.publicId),
  });
}

async function downloadRemoteMediaBuffer(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_MEDIA_DOWNLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Remote media download failed with ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}

export type DashboardTranscriptionListItem = {
  publicId: string;
  fileName: string;
  displayTitle: string | null;
  sourceType: TranscriptionSourceType;
  status: TranscriptionStatus;
  stage: TranscriptionStage;
  language: string | null;
  sourceDurationMs: number | null;
  processedDurationMs: number | null;
  durationLimitMs: number | null;
  wasDurationTrimmed: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

function generateNumericPublicId(): string {
  return `${Date.now()}${String(randomInt(0, 1_000_000)).padStart(6, "0")}`;
}

function summarizeStorageKey(key: string | null | undefined): string | null {
  if (!key) {
    return null;
  }

  const parts = key.split("/").filter(Boolean);
  return parts.slice(-3).join("/");
}

function getTranscriptionModelVersion(): string {
  return (
    getEnv("REPLICATE_TRANSCRIPTION_MODEL_VERSION") ||
    "744c4f2bffae674f82e79ed46f9cc54796d4903b3e20e68353e05a93eb10a55c"
  );
}

function getFileExtension(fileName: string, fallbackExtension: string = "bin"): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName);
  return match?.[1]?.toLowerCase() || fallbackExtension;
}

function normalizeProcessedDurationMs(
  sourceDurationMs: number | null | undefined,
  durationLimitMs: number | null | undefined
): {
  durationLimitMs: number | null;
  processedDurationMs: number | null;
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
      durationLimitMs: null,
      processedDurationMs: normalizedSource,
      wasDurationTrimmed: false,
    };
  }

  if (!normalizedSource) {
    return {
      durationLimitMs: normalizedLimit,
      processedDurationMs: normalizedLimit,
      wasDurationTrimmed: false,
    };
  }

  return {
    durationLimitMs: normalizedLimit,
    processedDurationMs: Math.min(normalizedSource, normalizedLimit),
    wasDurationTrimmed: normalizedSource > normalizedLimit,
  };
}

function clipTranscriptionSegmentsToDurationLimit(
  segments: TranscriptionSegment[],
  durationLimitMs: number | null | undefined
): {
  segments: TranscriptionSegment[];
  durationMs: number | null;
  wasTrimmed: boolean;
} {
  const normalizedLimit =
    typeof durationLimitMs === "number" && Number.isFinite(durationLimitMs) && durationLimitMs > 0
      ? Math.round(durationLimitMs)
      : null;

  if (!normalizedLimit) {
    const durationMs =
      segments.length > 0 ? Math.max(...segments.map((segment) => segment.endMs)) : null;
    return {
      segments,
      durationMs,
      wasTrimmed: false,
    };
  }

  const clippedSegments = segments
    .filter((segment) => segment.startMs < normalizedLimit)
    .map((segment) => ({
      ...segment,
      endMs: Math.max(
        segment.startMs + 1,
        Math.min(segment.endMs, normalizedLimit)
      ),
    }));

  const originalMaxEndMs =
    segments.length > 0 ? Math.max(...segments.map((segment) => segment.endMs)) : null;
  const clippedMaxEndMs =
    clippedSegments.length > 0
      ? Math.max(...clippedSegments.map((segment) => segment.endMs))
      : null;

  return {
    segments: clippedSegments,
    durationMs: clippedMaxEndMs,
    wasTrimmed: Boolean(
      originalMaxEndMs &&
        (originalMaxEndMs > normalizedLimit || clippedSegments.length < segments.length)
    ),
  };
}

function toIsoString(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function normalizeSummaryTemplateKey(
  value: string | null | undefined
): TranscriptionAiSummaryTemplateKey {
  return value === "general" ? "general" : "off";
}

function normalizeMindMapTemplateKey(
  value: string | null | undefined
): TranscriptionAiMindMapTemplateKey {
  return value === "general" ? "general" : "off";
}

function buildDisplayFullTextFromSegments(
  segments: Pick<DbTranscriptionDisplaySegment, "textCurrent">[]
): string | null {
  const value = segments.map((segment) => segment.textCurrent.trim()).filter(Boolean).join("\n\n");
  return value || null;
}

function buildCompactSegmentsJson(
  segments: TranscriptionSegment[]
) {
  return segments.map((segment) => ({
    id: segment.id,
    speaker: segment.speaker,
    rawSpeaker: segment.rawSpeaker ?? null,
    sourceStartIndex: segment.sourceStartIndex,
    sourceEndIndex: segment.sourceEndIndex,
    startMs: segment.startMs,
    endMs: segment.endMs,
    text: segment.text,
    words: (segment.words ?? []).map((word) => ({
      startMs: word.startMs,
      endMs: word.endMs,
      text: word.text,
      speaker: word.speaker ?? null,
      probability: word.probability ?? null,
    })),
  }));
}

async function finalizeCompletedTranscriptionJob(
  currentJob: TranscriptionJob,
  input: {
    publicId: string;
    transcriptSource: TranscriptionTranscriptSource;
    language: string | null;
    speakerCount: number | null;
    durationMs: number | null;
    segments: TranscriptionSegment[];
    replicatePredictionId?: string | null;
    replicateVersion?: string | null;
  }
): Promise<TranscriptionJob> {
  const projection = buildTranscriptionDisplayProjection(input.segments, {
    language: input.language,
  });
  const compactSegments = buildCompactSegmentsJson(input.segments);

  return db.transaction(async (tx) => {
    const [job] = await tx
      .update(transcriptionJobs)
      .set({
        status: "succeeded",
        stage: "completed",
        statusMessage: null,
        transcriptSource: input.transcriptSource,
        replicatePredictionId: input.replicatePredictionId ?? currentJob.replicatePredictionId,
        replicateVersion: input.replicateVersion ?? currentJob.replicateVersion,
        language: input.language,
        speakerCount: input.speakerCount,
        durationMs: input.durationMs,
        displayFullText: projection.displayFullText,
        displayVersion: 1,
        hasUserEdits: false,
        segmentsJson: compactSegments,
        errorCode: null,
        errorMessage: null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(transcriptionJobs.publicId, input.publicId))
      .returning();

    if (!job) {
      throw new Error(`Transcription job not found during completion: ${input.publicId}`);
    }

    await replaceTranscriptionDisplayProjection(tx, job, projection);
    return job;
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSearchReplaceRegExp({
  search,
  matchCase = false,
  wholeWord = false,
}: SearchReplaceOptions): RegExp {
  const source = wholeWord ? `\\b${escapeRegExp(search)}\\b` : escapeRegExp(search);
  return new RegExp(source, matchCase ? "g" : "gi");
}

function mapSpeakerRowToClientData(
  row: DbTranscriptionSpeaker
): TranscriptionSpeakerClientData {
  return {
    id: row.id,
    key: row.speakerKey,
    defaultLabel: row.defaultLabel,
    displayName: row.displayName ?? null,
    colorToken: row.colorToken as TranscriptionSpeakerClientData["colorToken"],
    orderIndex: row.orderIndex,
    isUnknown: row.isUnknown,
  };
}

function mapStoredDisplaySegmentToClientData(
  row: DbTranscriptionDisplaySegment,
  speaker: TranscriptionSpeakerClientData | null
): TranscriptionDisplaySegment {
  const speakerLabel =
    row.speakerLabelOverride?.trim() ||
    speaker?.displayName ||
    speaker?.defaultLabel ||
    null;

  return {
    id: row.id,
    speakerId: row.speakerId,
    speakerKey: speaker?.key ?? null,
    speakerLabel,
    speakerLabelOverride: row.speakerLabelOverride ?? null,
    speakerColorToken: speaker?.colorToken ?? "slate",
    isUnknownSpeaker: speaker?.isUnknown ?? true,
    orderIndex: row.orderIndex,
    sourceStartIndex: row.sourceStartIndex,
    sourceEndIndex: row.sourceEndIndex,
    startMs: row.startMs,
    endMs: row.endMs,
    text: row.textCurrent,
    textOriginal: row.textOriginal,
    isEdited: row.isEdited,
  };
}

function buildLegacyDisplayLayer(
  job: TranscriptionJob
): {
  speakers: TranscriptionSpeakerClientData[];
  segments: TranscriptionDisplaySegment[];
  displayFullText: string | null;
} {
  const rawSegments = coerceTranscriptionSegments(job.segmentsJson);
  const projection = buildTranscriptionDisplayProjection(rawSegments, {
    language: job.language ?? null,
  });
  const speakers = projection.speakers.map((speaker) => ({
    id: `legacy:${job.id}:${speaker.key}`,
    key: speaker.key,
    defaultLabel: speaker.defaultLabel,
    displayName: null,
    colorToken: speaker.colorToken,
    orderIndex: speaker.orderIndex,
    isUnknown: speaker.isUnknown,
  }));
  const speakerMap = new Map(speakers.map((speaker) => [speaker.key, speaker]));
  const segments = projection.segments.map((segment) =>
    mapStoredDisplaySegmentToClientData(
      {
        id: segment.id,
        transcriptionJobId: job.id,
        speakerId:
          speakerMap.get(segment.speakerKey)?.id ?? `legacy:${job.id}:${segment.speakerKey}`,
        orderIndex: segment.orderIndex,
        sourceStartIndex: segment.sourceStartIndex,
        sourceEndIndex: segment.sourceEndIndex,
        startMs: segment.startMs,
        endMs: segment.endMs,
        textOriginal: segment.textOriginal,
        textCurrent: segment.text,
        speakerLabelOverride: null,
        isEdited: segment.isEdited,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      },
      speakerMap.get(segment.speakerKey) ?? null
    )
  );

  return {
    speakers,
    segments,
    displayFullText: projection.displayFullText,
  };
}

async function loadStoredDisplayLayer(
  jobId: string
): Promise<{
  speakers: TranscriptionSpeakerClientData[];
  segments: TranscriptionDisplaySegment[];
  displayFullText: string | null;
} | null> {
  const [speakerRows, segmentRows] = await Promise.all([
    db
      .select()
      .from(transcriptionSpeakers)
      .where(eq(transcriptionSpeakers.transcriptionJobId, jobId))
      .orderBy(asc(transcriptionSpeakers.orderIndex)),
    db
      .select()
      .from(transcriptionDisplaySegments)
      .where(eq(transcriptionDisplaySegments.transcriptionJobId, jobId))
      .orderBy(asc(transcriptionDisplaySegments.orderIndex)),
  ]);

  if (speakerRows.length === 0 && segmentRows.length === 0) {
    return null;
  }

  const speakers = speakerRows.map(mapSpeakerRowToClientData);
  const speakerMap = new Map(speakers.map((speaker) => [speaker.id, speaker]));
  const segments = segmentRows.map((segment) =>
    mapStoredDisplaySegmentToClientData(
      segment,
      speakerMap.get(segment.speakerId) ?? null
    )
  );

  return {
    speakers,
    segments,
    displayFullText: buildDisplayFullTextFromSegments(segmentRows),
  };
}

async function loadDisplayLayerForJob(job: TranscriptionJob) {
  const stored = await loadStoredDisplayLayer(job.id);
  return stored ?? buildLegacyDisplayLayer(job);
}

async function replaceTranscriptionDisplayProjection(
  tx: DbTransaction,
  job: TranscriptionJob,
  projection: GeneratedTranscriptionDisplayProjection
): Promise<void> {
  await tx
    .delete(transcriptionDisplaySegments)
    .where(eq(transcriptionDisplaySegments.transcriptionJobId, job.id));
  await tx
    .delete(transcriptionSpeakers)
    .where(eq(transcriptionSpeakers.transcriptionJobId, job.id));

  if (projection.speakers.length === 0) {
    return;
  }

  const insertedSpeakers = await tx
    .insert(transcriptionSpeakers)
    .values(
      projection.speakers.map((speaker) => ({
        transcriptionJobId: job.id,
        speakerKey: speaker.key,
        defaultLabel: speaker.defaultLabel,
        displayName: null,
        colorToken: speaker.colorToken,
        orderIndex: speaker.orderIndex,
        isUnknown: speaker.isUnknown,
      }))
    )
    .returning();

  const speakerIdByKey = new Map(
    insertedSpeakers.map((speaker) => [speaker.speakerKey, speaker.id])
  );

  if (projection.segments.length === 0) {
    return;
  }

  await tx.insert(transcriptionDisplaySegments).values(
    projection.segments.map((segment) => {
      const speakerId = speakerIdByKey.get(segment.speakerKey);

      if (!speakerId) {
        throw new Error(`Missing speaker record for key: ${segment.speakerKey}`);
      }

      return {
        transcriptionJobId: job.id,
        speakerId,
        orderIndex: segment.orderIndex,
        sourceStartIndex: segment.sourceStartIndex,
        sourceEndIndex: segment.sourceEndIndex,
        startMs: segment.startMs,
        endMs: segment.endMs,
        textOriginal: segment.textOriginal,
        textCurrent: segment.text,
        isEdited: segment.isEdited,
      };
    })
  );
}

async function syncDisplayFullTextAndFlags(
  tx: DbTransaction,
  jobId: string,
  options: {
    markEdited: boolean;
    incrementDisplayVersion?: boolean;
  }
): Promise<TranscriptionJob> {
  const segmentRows = await tx
    .select({
      textCurrent: transcriptionDisplaySegments.textCurrent,
      isEdited: transcriptionDisplaySegments.isEdited,
    })
    .from(transcriptionDisplaySegments)
    .where(eq(transcriptionDisplaySegments.transcriptionJobId, jobId))
    .orderBy(asc(transcriptionDisplaySegments.orderIndex));
  const displayFullText = buildDisplayFullTextFromSegments(segmentRows);
  const hasUserEdits = options.markEdited
    ? true
    : segmentRows.some((segment) => segment.isEdited);
  const [job] = await tx
    .update(transcriptionJobs)
    .set({
      displayFullText,
      hasUserEdits,
      ...(options.incrementDisplayVersion
        ? {
            displayVersion: sql`${transcriptionJobs.displayVersion} + 1`,
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(transcriptionJobs.id, jobId))
    .returning();

  return job;
}

export async function serializeTranscriptionJob(
  job: TranscriptionJob
): Promise<TranscriptionJobClientData> {
  const displayLayer = await loadDisplayLayerForJob(job);

  return {
    id: job.id,
    publicId: job.publicId,
    status: job.status as TranscriptionStatus,
    stage: job.stage as TranscriptionStage,
    statusMessage: job.statusMessage ?? null,
    sourceType: job.sourceType as TranscriptionSourceType,
    fileName: job.sourceFileName,
    displayTitle: job.sourceDisplayTitle ?? null,
    transcriptSource: (job.transcriptSource as TranscriptionTranscriptSource | null) ?? null,
    contentType: job.sourceContentType,
    fileSize: job.sourceFileSize,
    sourceDurationMs: job.sourceDurationMs ?? null,
    processedDurationMs: job.processedDurationMs ?? null,
    durationLimitMs: job.durationLimitMs ?? null,
    wasDurationTrimmed: job.wasDurationTrimmed,
    summaryTemplateKey: normalizeSummaryTemplateKey(job.summaryTemplateKey),
    mindMapTemplateKey: normalizeMindMapTemplateKey(job.mindMapTemplateKey),
    language: job.language ?? null,
    speakerCount: job.speakerCount ?? null,
    durationMs: job.durationMs ?? null,
    displayVersion: job.displayVersion,
    fullText: displayLayer.displayFullText ?? job.displayFullText ?? null,
    displayFullText: displayLayer.displayFullText ?? job.displayFullText ?? null,
    speakers: displayLayer.speakers,
    segments: displayLayer.segments,
    errorMessage: job.errorMessage ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    completedAt: toIsoString(job.completedAt),
  };
}

export async function serializeTranscriptionReadResponse(
  job: TranscriptionJob,
  streamToken: string | null = null
): Promise<TranscriptionReadResponse> {
  return {
    task: await serializeTranscriptionJob(job),
    streamToken,
    aiArtifacts: await serializeTranscriptionAiArtifacts(job.id, job.displayVersion),
    translations: await serializeTranscriptionTranslations(job.id, job.displayVersion),
  };
}

async function publishJob(job: TranscriptionJob): Promise<void> {
  const aiArtifacts = await serializeTranscriptionAiArtifacts(job.id, job.displayVersion);
  const translations = await serializeTranscriptionTranslations(job.id, job.displayVersion);
  await publishTranscriptionRealtimeUpdate(
    await serializeTranscriptionJob(job),
    job.userId,
    aiArtifacts,
    translations
  );
}

export async function createTranscriptionJob(
  input: CreateTranscriptionJobInput
): Promise<TranscriptionJob> {
  const isAnonymousJob = !input.userId && Boolean(input.anonymousSessionId);
  const values: NewTranscriptionJob = {
    publicId: input.publicId ?? generateNumericPublicId(),
    userId: input.userId ?? null,
    anonymousSessionId: input.anonymousSessionId ?? null,
    status: "queued",
    stage: "queued",
    statusMessage: "Queued for processing",
    sourceType: input.sourceType,
    sourceFileName: input.fileName,
    sourceDisplayTitle: input.displayTitle?.trim() || null,
    sourceContentType: input.contentType,
    sourceFileSize: input.fileSize,
    sourceDurationMs: input.durationMs ?? null,
    ...normalizeProcessedDurationMs(input.durationMs ?? null, input.durationLimitMs ?? null),
    requestedLanguage: input.requestedLanguage ?? null,
    summaryTemplateKey: input.summaryTemplateKey ?? "off",
    mindMapTemplateKey: input.mindMapTemplateKey ?? "off",
    transcriptSource: input.transcriptSource ?? "ai_transcription",
    sourceR2Key: input.sourceR2Key,
    sourceUrl: input.sourceUrl,
    expiresAt: isAnonymousJob
      ? new Date(Date.now() + ANONYMOUS_TRANSCRIPTION_RETENTION_MS)
      : null,
  };

  const [job] = await db.insert(transcriptionJobs).values(values).returning();
  await publishJob(job);
  return job;
}

export async function getTranscriptionJobByPublicId(
  publicId: string
): Promise<TranscriptionJob | null> {
  const job = await db.query.transcriptionJobs.findFirst({
    where: eq(transcriptionJobs.publicId, publicId),
  });

  return job ?? null;
}

function collectTranscriptionStorageKeys(job: Pick<
  TranscriptionJob,
  "sourceR2Key" | "derivedAudioR2Key" | "rawOutputR2Key"
>): string[] {
  return [...new Set([
    job.sourceR2Key,
    job.derivedAudioR2Key,
    job.rawOutputR2Key,
  ].filter((value): value is string => Boolean(value && value.trim())))];
}

export async function deleteOwnerTranscriptionJob(input: {
  publicId: string;
  userId: string;
}): Promise<boolean> {
  const job = await db.query.transcriptionJobs.findFirst({
    where: and(
      eq(transcriptionJobs.publicId, input.publicId),
      eq(transcriptionJobs.userId, input.userId)
    ),
  });

  if (!job) {
    return false;
  }

  const storageKeys = collectTranscriptionStorageKeys(job);
  const deletedJob = await db.transaction(async (tx) => {
    await tx
      .delete(transcriptionFailureArchives)
      .where(eq(transcriptionFailureArchives.publicId, input.publicId));

    const [deleted] = await tx
      .delete(transcriptionJobs)
      .where(eq(transcriptionJobs.id, job.id))
      .returning({ id: transcriptionJobs.id });

    return deleted;
  });

  if (!deletedJob) {
    return false;
  }

  if (storageKeys.length > 0) {
    const cleanupResults = await Promise.allSettled(
      storageKeys.map((key) => deleteFromR2(key))
    );
    const failedKeys = cleanupResults.flatMap((result, index) =>
      result.status === "rejected" ? [storageKeys[index]!] : []
    );

    if (failedKeys.length > 0) {
      console.error("[Transcriptions] Failed to clean transcription storage objects", {
        publicId: input.publicId,
        failedKeys: failedKeys.map((key) => summarizeStorageKey(key)),
      });
    }
  }

  return true;
}

export async function renameTranscriptionDisplayTitle(
  publicId: string,
  displayTitle: string
): Promise<TranscriptionJob | null> {
  const job = await getTranscriptionJobByPublicId(publicId);
  if (!job) {
    return null;
  }

  const validation = validateTranscriptionDisplayTitle(displayTitle);
  if (!validation.ok) {
    if (validation.error === "empty") {
      throw new Error("Display title cannot be empty");
    }

    throw new Error("Display title is too long");
  }

  const updatedJob = await updateTranscriptionJob(
    publicId,
    {
      sourceDisplayTitle: validation.normalized,
    },
    false
  );

  return updatedJob;
}

function escapeIlikePattern(value: string): string {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

function buildDashboardTranscriptionListWhere(userId: string, query?: string) {
  const filters = [eq(transcriptionJobs.userId, userId)];
  const trimmedQuery = query?.trim();

  if (trimmedQuery) {
    const pattern = `%${escapeIlikePattern(trimmedQuery)}%`;
    filters.push(
      or(
        ilike(transcriptionJobs.sourceFileName, pattern),
        ilike(transcriptionJobs.sourceDisplayTitle, pattern)
      )!
    );
  }

  return and(...filters);
}

export async function listDashboardTranscriptionJobs(input: {
  userId: string;
  limit?: number;
  offset?: number;
  query?: string;
}): Promise<{
  items: DashboardTranscriptionListItem[];
  totalCount: number;
}> {
  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;
  const where = buildDashboardTranscriptionListWhere(input.userId, input.query);

  const [totalResult] = await db.select({ count: count() }).from(transcriptionJobs).where(where);

  const totalCount = totalResult?.count ?? 0;

  const jobs = await db.query.transcriptionJobs.findMany({
    where,
    orderBy: [desc(transcriptionJobs.createdAt)],
    limit,
    offset,
    columns: {
      publicId: true,
      sourceFileName: true,
      sourceDisplayTitle: true,
      sourceType: true,
      status: true,
      stage: true,
      language: true,
      sourceDurationMs: true,
      processedDurationMs: true,
      durationLimitMs: true,
      wasDurationTrimmed: true,
      createdAt: true,
      updatedAt: true,
      completedAt: true,
      userId: true,
      anonymousSessionId: true,
      expiresAt: true,
    },
  });

  const visibleJobs = jobs.filter((job) => !isTranscriptionJobExpired(job));

  return {
    totalCount: visibleJobs.length === jobs.length ? totalCount : visibleJobs.length,
    items: visibleJobs.map((job) => ({
      publicId: job.publicId,
      fileName: job.sourceFileName,
      displayTitle: job.sourceDisplayTitle ?? null,
      sourceType: job.sourceType as TranscriptionSourceType,
      status: job.status as TranscriptionStatus,
      stage: job.stage as TranscriptionStage,
      language: job.language ?? null,
      sourceDurationMs: job.sourceDurationMs ?? null,
      processedDurationMs: job.processedDurationMs ?? null,
      durationLimitMs: job.durationLimitMs ?? null,
      wasDurationTrimmed: job.wasDurationTrimmed,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      completedAt: toIsoString(job.completedAt),
    })),
  };
}

function buildAdminTranscriptionListWhere(input: {
  query?: string;
  ownerType?: "guest" | "registered";
  status?: "succeeded" | "failed";
}) {
  const conditions = [];

  const trimmedQuery = input.query?.trim();
  if (trimmedQuery) {
    const pattern = `%${escapeIlikePattern(trimmedQuery)}%`;
    conditions.push(
      or(
        ilike(transcriptionJobs.sourceFileName, pattern),
        ilike(transcriptionJobs.sourceDisplayTitle, pattern),
        ilike(transcriptionJobs.publicId, pattern),
        ilike(users.email, pattern)
      )
    );
  }

  if (input.ownerType === "guest") {
    conditions.push(isNull(transcriptionJobs.userId));
  } else if (input.ownerType === "registered") {
    conditions.push(isNotNull(transcriptionJobs.userId));
  }

  if (input.status === "succeeded" || input.status === "failed") {
    conditions.push(eq(transcriptionJobs.status, input.status));
  }

  if (conditions.length === 0) {
    return undefined;
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return and(...conditions);
}

function mapAdminTranscriptionListItem(input: {
  job: {
    publicId: string;
    sourceFileName: string;
    sourceDisplayTitle: string | null;
    sourceType: string;
    status: string;
    stage: string;
    language: string | null;
    sourceDurationMs: number | null;
    processedDurationMs: number | null;
    durationLimitMs: number | null;
    wasDurationTrimmed: boolean;
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
    userId: string | null;
    anonymousSessionId: string | null;
    expiresAt: Date | null;
    sourceR2Key: string | null;
  };
  userEmail: string | null;
}): AdminTranscriptionListItem {
  const { job, userEmail } = input;

  return {
    publicId: job.publicId,
    fileName: job.sourceFileName,
    displayTitle: job.sourceDisplayTitle ?? null,
    sourceType: job.sourceType as TranscriptionSourceType,
    status: job.status as TranscriptionStatus,
    stage: job.stage as TranscriptionStage,
    language: job.language ?? null,
    sourceDurationMs: job.sourceDurationMs ?? null,
    processedDurationMs: job.processedDurationMs ?? null,
    durationLimitMs: job.durationLimitMs ?? null,
    wasDurationTrimmed: job.wasDurationTrimmed,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    completedAt: toIsoString(job.completedAt),
    ownerType: job.userId ? "registered" : "anonymous",
    userId: job.userId ?? null,
    userEmail,
    isExpired: isTranscriptionJobExpired(job),
    hasSourceMedia: Boolean(job.sourceR2Key),
  };
}

export async function listAdminTranscriptionJobs(input: {
  limit?: number;
  offset?: number;
  query?: string;
  ownerType?: "guest" | "registered";
  status?: "succeeded" | "failed";
}): Promise<{
  items: AdminTranscriptionListItem[];
  totalCount: number;
}> {
  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;
  const where = buildAdminTranscriptionListWhere({
    query: input.query,
    ownerType: input.ownerType,
    status: input.status,
  });

  const countQuery = db
    .select({ count: count() })
    .from(transcriptionJobs)
    .leftJoin(users, eq(transcriptionJobs.userId, users.id));

  const [totalResult] = where ? await countQuery.where(where) : await countQuery;
  const totalCount = totalResult?.count ?? 0;

  const rowsQuery = db
    .select({
      publicId: transcriptionJobs.publicId,
      sourceFileName: transcriptionJobs.sourceFileName,
      sourceDisplayTitle: transcriptionJobs.sourceDisplayTitle,
      sourceType: transcriptionJobs.sourceType,
      status: transcriptionJobs.status,
      stage: transcriptionJobs.stage,
      language: transcriptionJobs.language,
      sourceDurationMs: transcriptionJobs.sourceDurationMs,
      processedDurationMs: transcriptionJobs.processedDurationMs,
      durationLimitMs: transcriptionJobs.durationLimitMs,
      wasDurationTrimmed: transcriptionJobs.wasDurationTrimmed,
      createdAt: transcriptionJobs.createdAt,
      updatedAt: transcriptionJobs.updatedAt,
      completedAt: transcriptionJobs.completedAt,
      userId: transcriptionJobs.userId,
      anonymousSessionId: transcriptionJobs.anonymousSessionId,
      expiresAt: transcriptionJobs.expiresAt,
      sourceR2Key: transcriptionJobs.sourceR2Key,
      userEmail: users.email,
    })
    .from(transcriptionJobs)
    .leftJoin(users, eq(transcriptionJobs.userId, users.id))
    .orderBy(desc(transcriptionJobs.createdAt))
    .limit(limit)
    .offset(offset);

  const rows = where ? await rowsQuery.where(where) : await rowsQuery;

  return {
    totalCount,
    items: rows.map((row) =>
      mapAdminTranscriptionListItem({
        job: row,
        userEmail: row.userEmail ?? null,
      })
    ),
  };
}

export async function resolveAdminTranscriptionSourceDownload(
  publicId: string
): Promise<{
  url: string;
  filename: string;
  contentType: string;
} | null> {
  const job = await getTranscriptionJobByPublicId(publicId);
  if (!job?.sourceR2Key) {
    return null;
  }

  const url = await getPresignedDownloadUrl(job.sourceR2Key, {
    filename: job.sourceFileName,
    contentType: job.sourceContentType,
    expiresIn: 300,
  });

  return {
    url,
    filename: job.sourceFileName,
    contentType: job.sourceContentType,
  };
}

export async function updateTranscriptionJob(
  publicId: string,
  values: Partial<NewTranscriptionJob>,
  publish: boolean = true
): Promise<TranscriptionJob | null> {
  const [job] = await db
    .update(transcriptionJobs)
    .set({
      ...values,
      updatedAt: new Date(),
    })
    .where(eq(transcriptionJobs.publicId, publicId))
    .returning();

  if (job && publish) {
    await publishJob(job);
  }

  return job ?? null;
}

export async function processTranscriptionJob(publicId: string): Promise<void> {
  const job = await getTranscriptionJobByPublicId(publicId);
  if (!job) {
    throw new Error(`Transcription job not found: ${publicId}`);
  }

  try {
    console.info("[Transcriptions] Starting job processing", {
      publicId,
      sourceType: job.sourceType,
      hasSourceR2Key: Boolean(job.sourceR2Key),
      sourceOrigin: job.sourceR2Key ? "r2_imported" : "external_url",
      sourceKey: summarizeStorageKey(job.sourceR2Key),
      sourceContentType: job.sourceContentType,
      sourceFileSizeBytes: job.sourceFileSize,
      originalDurationMs: job.sourceDurationMs,
      processedDurationMs: job.processedDurationMs,
      durationLimitMs: job.durationLimitMs,
      wasDurationTrimmed: job.wasDurationTrimmed,
    });

    const presignStartedAt = Date.now();
    let audioUrl = job.sourceUrl;
    if (job.sourceR2Key) {
      audioUrl = await getPresignedDownloadUrl(job.sourceR2Key, {
        expiresIn: REPLICATE_INPUT_URL_EXPIRES_IN_SECONDS,
        contentType: job.sourceContentType,
      });
    }
    const presignElapsedMs = Date.now() - presignStartedAt;
    if (!audioUrl) {
      throw new Error("Missing transcription media URL");
    }

    const durationLimitMs = job.durationLimitMs ?? null;
    const durationLimitSeconds =
      durationLimitMs && durationLimitMs > 0 ? durationLimitMs / 1000 : undefined;
    const requiresDurationVerification = durationLimitSeconds !== undefined;
    const sourceExtension = getFileExtension(job.sourceFileName, "bin");
    let sourceProbe: Awaited<ReturnType<typeof probeMediaUrlForTranscription>> | null = null;

    // Limited jobs must use the server-observed duration, never browser-provided metadata.
    if (requiresDurationVerification) {
      sourceProbe = await probeMediaUrlForTranscription(audioUrl);
      if (!sourceProbe.hasAudio) {
        throw new Error("The uploaded file does not contain a readable audio track");
      }
      if (sourceProbe.durationMs === null) {
        throw new Error("Unable to determine the uploaded file duration");
      }

      const verifiedDuration = normalizeProcessedDurationMs(sourceProbe.durationMs, durationLimitMs);
      await updateTranscriptionJob(publicId, {
        sourceDurationMs: sourceProbe.durationMs,
        ...verifiedDuration,
      }, false);
    }

    let usingDerivedAudio = false;
    let derivedAudioStrategy: "none" | "trim_source" = "none";
    const requiresDerivedAudio =
      requiresDurationVerification && sourceProbe !== null && sourceProbe.durationMs > durationLimitMs!;

    console.info("[Transcriptions] Media input routing", {
      publicId,
      sourceType: job.sourceType,
      sourceExtension,
      durationVerification: requiresDurationVerification,
      sourceFormatNames: sourceProbe?.formatNames ?? null,
      sourceAudioCodec: sourceProbe?.audioCodec ?? null,
      hasVideoTrack: sourceProbe?.hasVideo ?? null,
      hasAudioTrack: sourceProbe?.hasAudio ?? null,
      verifiedDurationMs: sourceProbe?.durationMs ?? null,
      delivery: requiresDerivedAudio ? "derived_flac" : "source_direct",
    });

    if (requiresDerivedAudio) {
      await updateTranscriptionJob(publicId, {
        status: "preprocessing",
        stage: "extracting_audio",
        statusMessage:
          job.sourceType === "video" ? "Extracting audio track" : "Preparing audio for transcription",
      }, false);

      const sourceBuffer = job.sourceR2Key
        ? await downloadFromR2(job.sourceR2Key)
        : await downloadRemoteMediaBuffer(job.sourceUrl);
      const audioBuffer = await prepareAudioBufferForTranscription({
        mediaBuffer: sourceBuffer,
        inputExtension: sourceExtension,
        maxDurationSeconds: durationLimitSeconds,
      });
      const ownerId = job.userId ? `user_${job.userId}` : `anon_${job.anonymousSessionId || "guest"}`;
      const derivedAudioR2Key = generateTranscriptionDerivedAudioKey(
        ownerId,
        TRANSCRIPTION_DERIVED_AUDIO_EXTENSION
      );
      await uploadToR2(audioBuffer, derivedAudioR2Key, TRANSCRIPTION_DERIVED_AUDIO_CONTENT_TYPE);
      usingDerivedAudio = true;
      derivedAudioStrategy =
        "trim_source";
      audioUrl = await getPresignedDownloadUrl(derivedAudioR2Key, {
        expiresIn: REPLICATE_INPUT_URL_EXPIRES_IN_SECONDS,
        contentType: TRANSCRIPTION_DERIVED_AUDIO_CONTENT_TYPE,
      });

      await updateTranscriptionJob(publicId, {
        status: "preprocessing",
        stage: "audio_extracted",
        statusMessage: "Audio extracted",
        derivedAudioR2Key,
        derivedAudioUrl: await resolveR2ObjectUrl(derivedAudioR2Key),
      });
    }

    await updateTranscriptionJob(publicId, {
      status: "transcribing",
      stage: "submitting_model",
      statusMessage: "Submitting to transcription model",
    }, false);

    const webhookToken = createTranscriptionWebhookToken(publicId);
    const webhookUrl = buildWebhookUrl(
      `/api/webhooks/replicate/transcriptions?token=${encodeURIComponent(webhookToken)}`
    );

    const submitPredictionStartedAt = Date.now();
    const replicateInput = {
      file_url: audioUrl,
      ...(job.requestedLanguage ? { language: job.requestedLanguage } : {}),
    };
    const prediction = await requestReplicatePrediction<ReplicatePredictionResponse>(
      {
        version: getTranscriptionModelVersion(),
        input: replicateInput,
        webhook: webhookUrl,
        webhook_events_filter: ["completed"],
      },
      {
        maxRetries: 2,
        logPrefix: `[Transcriptions:${publicId}]`,
        timeoutMs: 30000,
      }
    );
    const submitPredictionElapsedMs = Date.now() - submitPredictionStartedAt;

    console.info("[Transcriptions] Submitted prediction", {
      publicId,
      predictionId: prediction.id,
      sourceType: job.sourceType,
      sourceContentType: job.sourceContentType,
      originalDurationMs: job.sourceDurationMs,
      processedDurationMs: job.processedDurationMs,
      durationLimitMs: job.durationLimitMs,
      usingDerivedAudio,
      derivedAudioStrategy,
      requestedLanguage: job.requestedLanguage ?? "auto",
      presignElapsedMs,
      submitPredictionElapsedMs,
    });

    await updateTranscriptionJob(publicId, {
      status: "transcribing",
      stage: "waiting_result",
      statusMessage: "Waiting for transcription result",
      replicatePredictionId: prediction.id,
      replicateVersion: prediction.version || getTranscriptionModelVersion(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process transcription";

    const failedJob = await updateTranscriptionJob(publicId, {
      status: "failed",
      stage: "failed",
      statusMessage: null,
      errorCode: "TRANSCRIPTION_PROCESSING_FAILED",
      errorMessage: message,
      completedAt: new Date(),
    });

    if (failedJob) {
      await archiveTranscriptionFailure({
        job: failedJob,
        failureStage: "processing",
        errorCode: "TRANSCRIPTION_PROCESSING_FAILED",
        errorMessage: message,
      }).catch((archiveError) => {
        console.error("[Transcriptions] Failed to archive processing failure", { publicId, archiveError });
      });
      await refundTranscriptionCreditsIfNeeded(failedJob, "processing_failed").catch((refundError) => {
        console.error("[Transcriptions] Failed to refund credits after processing failure:", {
          publicId,
          refundError,
        });
      });
    }
  }
}

export async function completeTranscriptionJobFromReplicate(
  publicId: string,
  payload: ReplicatePredictionResponse
): Promise<TranscriptionJob | null> {
  const currentJob = await getTranscriptionJobByPublicId(publicId);
  if (!currentJob) {
    return null;
  }

  if (payload.status === "failed" || payload.status === "canceled") {
    const failedJob = await updateTranscriptionJob(publicId, {
      status: "failed",
      stage: "failed",
      statusMessage: null,
      errorCode: "TRANSCRIPTION_FAILED",
      errorMessage: payload.error || "Transcription failed",
      completedAt: new Date(),
    });

    if (failedJob) {
      await archiveTranscriptionFailure({
        job: failedJob,
        failureStage: "provider_result",
        errorCode: "TRANSCRIPTION_FAILED",
        errorMessage: payload.error || "Transcription failed",
      }).catch((archiveError) => {
        console.error("[Transcriptions] Failed to archive provider failure", { publicId, archiveError });
      });
      await refundTranscriptionCreditsIfNeeded(failedJob, "transcription_failed").catch(
        (refundError) => {
          console.error("[Transcriptions] Failed to refund credits after transcription failure:", {
            publicId,
            refundError,
          });
        }
      );
    }

    return failedJob;
  }

  const normalized = normalizeReplicateTranscriptionOutput(payload.output);
  const completedJob = await finalizeCompletedTranscriptionJob(currentJob, {
    publicId,
    transcriptSource: "ai_transcription",
    language: normalized.language,
    speakerCount: normalized.speakerCount,
    durationMs: normalized.durationMs,
    segments: normalized.segments,
    replicatePredictionId: payload.id,
    replicateVersion: payload.version || currentJob.replicateVersion,
  });

  console.info("[Transcriptions] Completed job from Replicate", {
    publicId,
    predictionId: payload.id,
    requestedLanguage: currentJob.requestedLanguage ?? "auto",
    detectedLanguage: normalized.language,
    segmentCount: normalized.segments.length,
    speakerCount: normalized.speakerCount,
  });

  await publishJob(completedJob);
  return completedJob;
}

export async function completeTranscriptionJobFromYouTubeCaptions(input: {
  publicId: string;
  transcriptSource: Extract<
    TranscriptionTranscriptSource,
    "youtube_manual_captions" | "youtube_auto_captions"
  >;
  language: string | null;
  durationMs: number | null;
  segments: TranscriptionSegment[];
}): Promise<TranscriptionJob | null> {
  const currentJob = await getTranscriptionJobByPublicId(input.publicId);
  if (!currentJob) {
    return null;
  }

  const clippedTranscript = clipTranscriptionSegmentsToDurationLimit(
    input.segments,
    currentJob.durationLimitMs
  );
  const normalizedProcessed = normalizeProcessedDurationMs(
    input.durationMs ?? clippedTranscript.durationMs ?? currentJob.sourceDurationMs,
    currentJob.durationLimitMs
  );

  const completedJob = await finalizeCompletedTranscriptionJob(currentJob, {
    publicId: input.publicId,
    transcriptSource: input.transcriptSource,
    language: input.language,
    speakerCount: null,
    durationMs: clippedTranscript.durationMs,
    segments: clippedTranscript.segments,
  });

  const durationPatchedJob = await updateTranscriptionJob(
    input.publicId,
    {
      processedDurationMs: normalizedProcessed.processedDurationMs,
      durationLimitMs: normalizedProcessed.durationLimitMs,
      wasDurationTrimmed:
        currentJob.wasDurationTrimmed ||
        normalizedProcessed.wasDurationTrimmed ||
        clippedTranscript.wasTrimmed,
    },
    false
  );

  const finalJob = durationPatchedJob ?? completedJob;

  await publishJob(finalJob);
  return finalJob;
}

export async function archiveTranscriptionRawOutput(
  publicId: string,
  predictionId: string | undefined,
  rawOutput: unknown
): Promise<void> {
  if (rawOutput === null || rawOutput === undefined) {
    return;
  }

  const job = await getTranscriptionJobByPublicId(publicId);
  if (!job || job.rawOutputR2Key) {
    return;
  }

  const ownerId = job.userId ? `user_${job.userId}` : `anon_${job.anonymousSessionId || "guest"}`;
  const rawOutputR2Key = generateTranscriptionRawOutputKey(ownerId, predictionId || job.publicId);
  const payload = Buffer.from(JSON.stringify(rawOutput), "utf8");
  await uploadToR2(payload, rawOutputR2Key, "application/json");

  await db
    .update(transcriptionJobs)
    .set({
      rawOutputR2Key,
      updatedAt: new Date(),
    })
    .where(eq(transcriptionJobs.id, job.id));
}

export async function renameTranscriptionSpeaker(
  publicId: string,
  speakerId: string,
  displayName: string | null
): Promise<TranscriptionJob | null> {
  const job = await getTranscriptionJobByPublicId(publicId);
  if (!job) {
    return null;
  }

  let normalizedDisplayName: string | null = null;
  if (displayName !== null && displayName !== undefined) {
    const validation = validateSpeakerDisplayName(displayName);
    if (!validation.ok) {
      throw new Error(
        validation.error === "too_long"
          ? "Speaker name is too long"
          : "Speaker name cannot be empty"
      );
    }
    normalizedDisplayName = validation.normalized;
  }

  const updatedJob = await db.transaction(async (tx) => {
    const [speaker] = await tx
      .select()
      .from(transcriptionSpeakers)
      .where(eq(transcriptionSpeakers.id, speakerId))
      .limit(1);

    if (!speaker || speaker.transcriptionJobId !== job.id) {
      return null;
    }

    await tx
      .update(transcriptionSpeakers)
      .set({
        displayName: normalizedDisplayName,
        updatedAt: new Date(),
      })
      .where(eq(transcriptionSpeakers.id, speakerId));

    const [updated] = await tx
      .update(transcriptionJobs)
      .set({
        hasUserEdits: true,
        displayVersion: sql`${transcriptionJobs.displayVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(transcriptionJobs.id, job.id))
      .returning();

    return updated ?? null;
  });

  if (updatedJob) {
    await publishJob(updatedJob);
  }

  return updatedJob;
}

export async function bulkRenameTranscriptionSpeakersByLabel(
  publicId: string,
  matchLabel: string,
  displayName: string
): Promise<TranscriptionJob | null> {
  const job = await getTranscriptionJobByPublicId(publicId);
  if (!job) {
    return null;
  }

  const validation = validateSpeakerDisplayName(displayName);
  if (!validation.ok) {
    throw new Error(
      validation.error === "too_long"
        ? "Speaker name is too long"
        : "Speaker name cannot be empty"
    );
  }

  const normalizedMatchLabel = matchLabel.trim();
  if (!normalizedMatchLabel) {
    throw new Error("Match label cannot be empty");
  }

  const updatedJob = await db.transaction(async (tx) => {
    const [speakerRows, segmentRows] = await Promise.all([
      tx
        .select()
        .from(transcriptionSpeakers)
        .where(eq(transcriptionSpeakers.transcriptionJobId, job.id)),
      tx
        .select({
          id: transcriptionDisplaySegments.id,
          speakerLabelOverride: transcriptionDisplaySegments.speakerLabelOverride,
        })
        .from(transcriptionDisplaySegments)
        .where(eq(transcriptionDisplaySegments.transcriptionJobId, job.id)),
    ]);

    const matchingSpeakerIds = speakerRows
      .filter(
        (speaker) =>
          getSpeakerEffectiveLabel({
            displayName: speaker.displayName ?? null,
            defaultLabel: speaker.defaultLabel,
          }) === normalizedMatchLabel
      )
      .map((speaker) => speaker.id);

    const matchingSegmentIds = segmentRows
      .filter(
        (segment) =>
          segment.speakerLabelOverride?.trim() === normalizedMatchLabel
      )
      .map((segment) => segment.id);

    if (matchingSpeakerIds.length === 0 && matchingSegmentIds.length === 0) {
      return null;
    }

    if (matchingSpeakerIds.length > 0) {
      await tx
        .update(transcriptionSpeakers)
        .set({
          displayName: validation.normalized,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(transcriptionSpeakers.transcriptionJobId, job.id),
            inArray(transcriptionSpeakers.id, matchingSpeakerIds)
          )
        );
    }

    if (matchingSegmentIds.length > 0) {
      await tx
        .update(transcriptionDisplaySegments)
        .set({
          speakerLabelOverride: validation.normalized,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(transcriptionDisplaySegments.transcriptionJobId, job.id),
            inArray(transcriptionDisplaySegments.id, matchingSegmentIds)
          )
        );
    }

    return syncDisplayFullTextAndFlags(tx, job.id, {
      markEdited: true,
      incrementDisplayVersion: true,
    });
  });

  if (updatedJob) {
    await publishJob(updatedJob);
  }

  return updatedJob;
}

export async function updateTranscriptionDisplaySegmentSpeakerOverride(
  publicId: string,
  segmentId: string,
  speakerLabelOverride: string | null
): Promise<TranscriptionJob | null> {
  const job = await getTranscriptionJobByPublicId(publicId);
  if (!job) {
    return null;
  }

  let normalizedOverride: string | null = null;
  if (speakerLabelOverride !== null && speakerLabelOverride !== undefined) {
    const validation = validateSpeakerDisplayName(speakerLabelOverride);
    if (!validation.ok) {
      throw new Error(
        validation.error === "too_long"
          ? "Speaker name is too long"
          : "Speaker name cannot be empty"
      );
    }
    normalizedOverride = validation.normalized;
  }

  const updatedJob = await db.transaction(async (tx) => {
    const [segment] = await tx
      .select()
      .from(transcriptionDisplaySegments)
      .where(eq(transcriptionDisplaySegments.id, segmentId))
      .limit(1);

    if (!segment || segment.transcriptionJobId !== job.id) {
      return null;
    }

    await tx
      .update(transcriptionDisplaySegments)
      .set({
        speakerLabelOverride: normalizedOverride,
        updatedAt: new Date(),
      })
      .where(eq(transcriptionDisplaySegments.id, segmentId));

    return syncDisplayFullTextAndFlags(tx, job.id, {
      markEdited: true,
      incrementDisplayVersion: true,
    });
  });

  if (updatedJob) {
    await publishJob(updatedJob);
  }

  return updatedJob;
}

export async function updateTranscriptionDisplaySegmentText(
  publicId: string,
  segmentId: string,
  text: string
): Promise<TranscriptionJob | null> {
  const job = await getTranscriptionJobByPublicId(publicId);
  if (!job) {
    return null;
  }

  const normalizedText = text.trim();
  if (!normalizedText) {
    throw new Error("Segment text cannot be empty");
  }

  const updatedJob = await db.transaction(async (tx) => {
    const [segment] = await tx
      .select()
      .from(transcriptionDisplaySegments)
      .where(eq(transcriptionDisplaySegments.id, segmentId))
      .limit(1);

    if (!segment || segment.transcriptionJobId !== job.id) {
      return null;
    }

    await tx
      .update(transcriptionDisplaySegments)
      .set({
        textCurrent: normalizedText,
        isEdited: normalizedText !== segment.textOriginal,
        updatedAt: new Date(),
      })
      .where(eq(transcriptionDisplaySegments.id, segmentId));

    return syncDisplayFullTextAndFlags(tx, job.id, {
      markEdited: true,
      incrementDisplayVersion: true,
    });
  });

  if (updatedJob) {
    await publishJob(updatedJob);
  }

  return updatedJob;
}

export async function replaceTextAcrossTranscriptionDisplaySegments(
  publicId: string,
  options: SearchReplaceOptions
): Promise<TranscriptionJob | null> {
  const job = await getTranscriptionJobByPublicId(publicId);
  if (!job) {
    return null;
  }

  const search = options.search.trim();
  if (!search) {
    throw new Error("Search text is required");
  }

  const pattern = buildSearchReplaceRegExp({
    search,
    replace: options.replace,
    matchCase: options.matchCase,
    wholeWord: options.wholeWord,
  });

  const updatedJob = await db.transaction(async (tx) => {
    const segments = await tx
      .select()
      .from(transcriptionDisplaySegments)
      .where(eq(transcriptionDisplaySegments.transcriptionJobId, job.id))
      .orderBy(asc(transcriptionDisplaySegments.orderIndex));

    const updates = segments
      .map((segment) => {
        const nextText = segment.textCurrent.replace(pattern, options.replace);
        return nextText !== segment.textCurrent
          ? {
              id: segment.id,
              textCurrent: nextText,
              isEdited: nextText !== segment.textOriginal,
            }
          : null;
      })
      .filter((segment): segment is NonNullable<typeof segment> => segment !== null);

    if (updates.length === 0) {
      return job;
    }

    await Promise.all(
      updates.map((segment) =>
        tx
          .update(transcriptionDisplaySegments)
          .set({
            textCurrent: segment.textCurrent,
            isEdited: segment.isEdited,
            updatedAt: new Date(),
          })
          .where(eq(transcriptionDisplaySegments.id, segment.id))
      )
    );

    return syncDisplayFullTextAndFlags(tx, job.id, {
      markEdited: true,
      incrementDisplayVersion: true,
    });
  });

  if (updatedJob) {
    await publishJob(updatedJob);
  }

  return updatedJob;
}

export async function saveTranscriptionFeedback(
  input: SaveTranscriptionFeedbackInput
): Promise<void> {
  const rating = input.rating;
  const feedbackText = input.feedbackText?.trim() || null;
  const userId = input.userId ?? null;
  const anonymousSessionId = input.anonymousSessionId ?? null;

  if (!userId && !anonymousSessionId) {
    throw new Error("Feedback owner is required");
  }

  const job = await getTranscriptionJobByPublicId(input.publicId);
  if (!job) {
    throw new Error("Transcription not found");
  }

  const values: NewTranscriptionFeedback = {
    transcriptionJobId: job.id,
    userId,
    anonymousSessionId,
    rating,
    feedbackText,
  };

  await db.transaction(async (tx) => {
    const whereClause = userId
      ? and(
          eq(transcriptionFeedback.transcriptionJobId, job.id),
          eq(transcriptionFeedback.userId, userId)
        )
      : and(
          eq(transcriptionFeedback.transcriptionJobId, job.id),
          eq(transcriptionFeedback.anonymousSessionId, anonymousSessionId as string)
        );

    const [existing] = await tx
      .select()
      .from(transcriptionFeedback)
      .where(whereClause)
      .limit(1);

    if (existing) {
      await tx
        .update(transcriptionFeedback)
        .set({
          rating,
          feedbackText,
          updatedAt: new Date(),
        })
        .where(eq(transcriptionFeedback.id, existing.id));
      return;
    }

    await tx.insert(transcriptionFeedback).values(values);
  });
}

export async function claimAnonymousTranscriptionJob(input: {
  publicId: string;
  userId: string;
  anonymousSessionId: string;
}): Promise<TranscriptionJob | null> {
  const job = await getTranscriptionJobByPublicId(input.publicId);
  if (!job) {
    return null;
  }

  if (job.userId) {
    return job.userId === input.userId ? job : null;
  }

  if (!job.anonymousSessionId || job.anonymousSessionId !== input.anonymousSessionId) {
    return null;
  }

  if (isTranscriptionJobExpired(job)) {
    return null;
  }

  const updatedJob = await db.transaction(async (tx) => {
    const [latestJob] = await tx
      .select()
      .from(transcriptionJobs)
      .where(eq(transcriptionJobs.id, job.id))
      .limit(1);

    if (!latestJob) {
      return null;
    }

    if (latestJob.userId) {
      return latestJob.userId === input.userId ? latestJob : null;
    }

    if (
      !latestJob.anonymousSessionId ||
      latestJob.anonymousSessionId !== input.anonymousSessionId
    ) {
      return null;
    }

    if (isTranscriptionJobExpired(latestJob)) {
      return null;
    }

    await tx
      .update(transcriptionFeedback)
      .set({
        userId: input.userId,
        anonymousSessionId: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(transcriptionFeedback.transcriptionJobId, latestJob.id),
          eq(transcriptionFeedback.anonymousSessionId, input.anonymousSessionId)
        )
      );

    const [claimedJob] = await tx
      .update(transcriptionJobs)
      .set({
        userId: input.userId,
        anonymousSessionId: null,
        expiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(transcriptionJobs.id, latestJob.id))
      .returning();

    return claimedJob ?? null;
  });

  if (updatedJob) {
    await publishJob(updatedJob);
  }

  return updatedJob;
}

export async function resolveTranscriptionPlaybackUrl(
  job: TranscriptionJob
): Promise<{
  url: string;
  expiresIn: number;
}> {
  const expiresIn = 900;

  if (job.derivedAudioR2Key) {
    return {
      url: await getPresignedDownloadUrl(job.derivedAudioR2Key, {
        filename: `${job.sourceFileName.replace(/\.[^.]+$/, "") || "transcription"}.flac`,
        contentType: TRANSCRIPTION_DERIVED_AUDIO_CONTENT_TYPE,
        expiresIn,
      }),
      expiresIn,
    };
  }

  if (job.derivedAudioUrl) {
    return {
      url: job.derivedAudioUrl,
      expiresIn,
    };
  }

  if (job.sourceR2Key) {
    return {
      url: await getPresignedDownloadUrl(job.sourceR2Key, {
        filename: job.sourceFileName,
        contentType: job.sourceContentType,
        expiresIn,
      }),
      expiresIn,
    };
  }

  if (job.sourceUrl) {
    return {
      url: job.sourceUrl,
      expiresIn,
    };
  }

  throw new Error("Playback source is unavailable for this transcription");
}

export async function cleanupExpiredAnonymousTranscriptionJobs(input?: {
  limit?: number;
}): Promise<{
  scanned: number;
  deleted: number;
  deletedPublicIds: string[];
  storageCleanupFailed: Array<{
    publicId: string;
    keys: string[];
  }>;
  failed: Array<{
    publicId: string;
    reason: string;
  }>;
}> {
  const limit = Math.max(1, Math.min(input?.limit ?? 100, 500));
  const jobs = await db.query.transcriptionJobs.findMany({
    where: and(
      sql`${transcriptionJobs.userId} is null`,
      sql`${transcriptionJobs.anonymousSessionId} is not null`,
      ne(transcriptionJobs.status, "failed"),
      lte(transcriptionJobs.expiresAt, new Date())
    ),
    orderBy: [asc(transcriptionJobs.expiresAt), asc(transcriptionJobs.createdAt)],
    limit,
    columns: {
      id: true,
      publicId: true,
      sourceR2Key: true,
      derivedAudioR2Key: true,
      rawOutputR2Key: true,
    },
  });

  const deletedPublicIds: string[] = [];
  const storageCleanupFailed: Array<{ publicId: string; keys: string[] }> = [];
  const failed: Array<{ publicId: string; reason: string }> = [];

  for (const job of jobs) {
    const storageKeys = collectTranscriptionStorageKeys(job);

    try {
      const [deletedJob] = await db
        .delete(transcriptionJobs)
        .where(eq(transcriptionJobs.id, job.id))
        .returning({ id: transcriptionJobs.id });

      if (!deletedJob) {
        failed.push({
          publicId: job.publicId,
          reason: "delete_failed",
        });
        continue;
      }

      deletedPublicIds.push(job.publicId);

      if (storageKeys.length === 0) {
        continue;
      }

      const cleanupResults = await Promise.allSettled(
        storageKeys.map((key) => deleteFromR2(key))
      );
      const failedKeys = cleanupResults.flatMap((result, index) =>
        result.status === "rejected" ? [storageKeys[index]!] : []
      );

      if (failedKeys.length > 0) {
        storageCleanupFailed.push({
          publicId: job.publicId,
          keys: failedKeys.map((key) => summarizeStorageKey(key)),
        });

        console.error("[Transcriptions] Failed to clean expired transcription storage objects", {
          publicId: job.publicId,
          failedKeys: failedKeys.map((key) => summarizeStorageKey(key)),
        });
      }
    } catch (error) {
      failed.push({
        publicId: job.publicId,
        reason: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }

  return {
    scanned: jobs.length,
    deleted: deletedPublicIds.length,
    deletedPublicIds,
    storageCleanupFailed,
    failed,
  };
}
