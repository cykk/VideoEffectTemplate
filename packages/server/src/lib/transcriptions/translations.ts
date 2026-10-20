import AlimtClient, {
  GetBatchTranslateRequest,
  TranslateGeneralRequest,
} from "@alicloud/alimt20181012";
import * as OpenApiClient from "@alicloud/openapi-client";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@markless/server/src/lib/db";
import {
  transcriptionDisplaySegments,
  transcriptionJobs,
  transcriptionTranslationJobs,
  transcriptionTranslationSegments,
  type TranscriptionJob,
  type TranscriptionTranslationJob,
} from "@markless/server/src/lib/db/schema/transcriptions";
import { getEnv, requireEnv } from "@markless/shared/src/lib/config/env";
import { publishTranscriptionRealtimeUpdate } from "@markless/shared/src/lib/transcriptions/events";
import type {
  TranscriptionAiArtifactCollectionClientData,
  TranscriptionTranslationClientData,
  TranscriptionTranslationCollectionClientData,
  TranscriptionTranslationSegmentClientData,
} from "@markless/shared/src/types/transcriptions";
import { serializeTranscriptionAiArtifacts } from "@markless/server/src/lib/transcriptions/ai-artifacts";
import { serializeTranscriptionJob } from "@markless/server/src/lib/transcriptions/service";

type SourceSegmentRow = {
  id: string;
  orderIndex: number;
  textCurrent: string;
};

type CreateTranslationRequestResult = {
  translation: TranscriptionTranslationClientData;
  queued: boolean;
};

const DEFAULT_PROVIDER = "aliyun";
const DEFAULT_MODEL = "general";
const DEFAULT_BATCH_API_TYPE = "translate_standard";
const MAX_BATCH_SEGMENTS = 40;
const MAX_BATCH_CHARACTERS = 7000;
const MAX_BATCH_SEGMENT_CHARACTERS = 900;
const MAX_SINGLE_SEGMENT_CHARACTERS = 4500;
const BATCH_TRANSLATION_CONCURRENCY = 3;
const SINGLE_TRANSLATION_CONCURRENCY = 3;
const MAX_INLINE_TRANSLATION_EVENT_BYTES = 512 * 1024;
let aliyunClientInstance: AlimtClient | null = null;

type TranslationBatchPlan = {
  batchIndex: number;
  segments: Array<
    SourceSegmentRow & {
      normalizedText: string;
      charCount: number;
    }
  >;
  charCount: number;
};

type SingleTranslationPlanItem = SourceSegmentRow & {
  normalizedText: string;
  charCount: number;
};

type TranslationExecutionPlan = {
  batches: TranslationBatchPlan[];
  singleSegments: SingleTranslationPlanItem[];
  emptySegments: Array<{
    sourceSegmentId: string;
    orderIndex: number;
    textTranslated: string;
  }>;
};

function getAliyunConfig() {
  return {
    accessKeyId: requireEnv("ALIYUN_MT_ACCESS_KEY_ID"),
    accessKeySecret: requireEnv("ALIYUN_MT_ACCESS_KEY_SECRET"),
    endpoint: getEnv("ALIYUN_MT_ENDPOINT", "mt.cn-hangzhou.aliyuncs.com")!,
    regionId: getEnv("ALIYUN_MT_REGION_ID", "cn-hangzhou")!,
    apiVersion: getEnv("ALIYUN_MT_API_VERSION", "2018-10-12")!,
    formatType: "text",
    scene: getEnv("ALIYUN_MT_SCENE", "general")!,
    batchApiType: getEnv("ALIYUN_MT_BATCH_API_TYPE", DEFAULT_BATCH_API_TYPE)!,
  };
}

function toIsoString(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function normalizeLanguageCode(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeSourceLanguage(value: string | null | undefined): string {
  const normalized = (value || "").trim().toLowerCase();
  return normalized || "auto";
}

function buildEmptyArtifacts(): TranscriptionAiArtifactCollectionClientData {
  return {
    summary: null,
    mind_map: null,
  };
}

function normalizeSegmentText(text: string): string {
  return text.trim();
}

function countTranslationCharacters(text: string): number {
  return Array.from(text).length;
}

function getAliyunClient(): AlimtClient {
  if (aliyunClientInstance) {
    return aliyunClientInstance;
  }

  const config = getAliyunConfig();
  const clientConfig = new OpenApiClient.Config({
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    endpoint: config.endpoint,
    regionId: config.regionId,
    protocol: "HTTPS",
    connectTimeout: 10_000,
    readTimeout: 20_000,
  });

  aliyunClientInstance = new AlimtClient(clientConfig);
  return aliyunClientInstance;
}

function mapTranslationRowToClientData(
  row: TranscriptionTranslationJob,
  currentDisplayVersion: number,
  segments: TranscriptionTranslationSegmentClientData[] | null
): TranscriptionTranslationClientData {
  return {
    targetLanguage: row.targetLanguage,
    sourceLanguage: row.sourceLanguage ?? null,
    status: row.status as TranscriptionTranslationClientData["status"],
    sourceDisplayVersion: row.sourceDisplayVersion,
    provider: row.provider,
    model: row.model,
    errorMessage: row.errorMessage ?? null,
    generatedAt: toIsoString(row.generatedAt),
    updatedAt: row.updatedAt.toISOString(),
    isStale: row.sourceDisplayVersion !== currentDisplayVersion,
    segments,
  };
}

export async function serializeTranscriptionTranslations(
  transcriptionJobId: string,
  currentDisplayVersion: number
): Promise<TranscriptionTranslationCollectionClientData> {
  const rows = await db
    .select()
    .from(transcriptionTranslationJobs)
    .where(eq(transcriptionTranslationJobs.transcriptionJobId, transcriptionJobId));

  const collection: TranscriptionTranslationCollectionClientData = {};
  for (const row of rows) {
    collection[row.targetLanguage] = mapTranslationRowToClientData(
      row,
      currentDisplayVersion,
      null
    );
  }

  return collection;
}

export async function getTranscriptionTranslationDetail(
  transcriptionJobId: string,
  targetLanguage: string,
  currentDisplayVersion: number
): Promise<TranscriptionTranslationClientData | null> {
  const row = await db.query.transcriptionTranslationJobs.findFirst({
    where: and(
      eq(transcriptionTranslationJobs.transcriptionJobId, transcriptionJobId),
      eq(transcriptionTranslationJobs.targetLanguage, targetLanguage)
    ),
  });

  if (!row) {
    return null;
  }

  const segments =
    row.status === "completed"
      ? await db
          .select({
            sourceSegmentId: transcriptionTranslationSegments.sourceSegmentId,
            orderIndex: transcriptionTranslationSegments.orderIndex,
            textTranslated: transcriptionTranslationSegments.textTranslated,
          })
          .from(transcriptionTranslationSegments)
          .where(eq(transcriptionTranslationSegments.translationJobId, row.id))
          .orderBy(asc(transcriptionTranslationSegments.orderIndex))
      : [];

  return mapTranslationRowToClientData(
    row,
    currentDisplayVersion,
    row.status === "completed" ? segments : null
  );
}

async function getTranscriptionTranslationDetailByJob(
  row: TranscriptionTranslationJob,
  currentDisplayVersion: number
): Promise<TranscriptionTranslationClientData> {
  const segments =
    row.status === "completed"
      ? await db
          .select({
            sourceSegmentId: transcriptionTranslationSegments.sourceSegmentId,
            orderIndex: transcriptionTranslationSegments.orderIndex,
            textTranslated: transcriptionTranslationSegments.textTranslated,
          })
          .from(transcriptionTranslationSegments)
          .where(eq(transcriptionTranslationSegments.translationJobId, row.id))
          .orderBy(asc(transcriptionTranslationSegments.orderIndex))
      : [];

  return mapTranslationRowToClientData(
    row,
    currentDisplayVersion,
    row.status === "completed" ? segments : null
  );
}

async function loadSourceSegments(jobId: string): Promise<SourceSegmentRow[]> {
  return db
    .select({
      id: transcriptionDisplaySegments.id,
      orderIndex: transcriptionDisplaySegments.orderIndex,
      textCurrent: transcriptionDisplaySegments.textCurrent,
    })
    .from(transcriptionDisplaySegments)
    .where(eq(transcriptionDisplaySegments.transcriptionJobId, jobId))
    .orderBy(asc(transcriptionDisplaySegments.orderIndex));
}

function buildSegmentBatches(segments: SourceSegmentRow[]): TranslationExecutionPlan {
  const executionPlan: TranslationExecutionPlan = {
    batches: [],
    singleSegments: [],
    emptySegments: [],
  };
  let currentBatchSegments: TranslationBatchPlan["segments"] = [];
  let currentBatchCharCount = 0;
  let batchIndex = 0;

  const flushBatch = () => {
    if (currentBatchSegments.length === 0) {
      return;
    }

    executionPlan.batches.push({
      batchIndex,
      segments: currentBatchSegments,
      charCount: currentBatchCharCount,
    });
    batchIndex += 1;
    currentBatchSegments = [];
    currentBatchCharCount = 0;
  };

  for (const segment of segments) {
    const normalizedText = normalizeSegmentText(segment.textCurrent);
    const charCount = countTranslationCharacters(normalizedText);

    if (!normalizedText) {
      executionPlan.emptySegments.push({
        sourceSegmentId: segment.id,
        orderIndex: segment.orderIndex,
        textTranslated: "",
      });
      continue;
    }

    if (charCount > MAX_SINGLE_SEGMENT_CHARACTERS) {
      throw new Error(
        `Segment ${segment.orderIndex} exceeds the maximum supported translation length`
      );
    }

    const planItem = {
      ...segment,
      normalizedText,
      charCount,
    };

    if (charCount > MAX_BATCH_SEGMENT_CHARACTERS) {
      flushBatch();
      executionPlan.singleSegments.push(planItem);
      continue;
    }

    const nextBatchCharCount = currentBatchCharCount + charCount;
    if (
      currentBatchSegments.length > 0 &&
      (currentBatchSegments.length >= MAX_BATCH_SEGMENTS ||
        nextBatchCharCount > MAX_BATCH_CHARACTERS)
    ) {
      flushBatch();
    }

    currentBatchSegments.push(planItem);
    currentBatchCharCount += charCount;
  }

  flushBatch();

  return executionPlan;
}

async function translateTextWithAliyun(input: {
  sourceLanguage: string;
  targetLanguage: string;
  text: string;
}): Promise<string> {
  const config = getAliyunConfig();
  const client = getAliyunClient();
  const request = new TranslateGeneralRequest({
    formatType: config.formatType,
    scene: config.scene,
    sourceLanguage: input.sourceLanguage,
    sourceText: input.text,
    targetLanguage: input.targetLanguage,
  });

  const response = await client.translateGeneral(request);
  const translated = response.body?.data?.translated?.trim();
  if (!translated) {
    throw new Error(response.body?.message || "Aliyun translate returned empty result");
  }

  return translated;
}

async function translateBatchWithAliyun(input: {
  sourceLanguage: string;
  targetLanguage: string;
  batch: TranslationBatchPlan;
}): Promise<
  Array<{
    sourceSegmentId: string;
    orderIndex: number;
    textTranslated: string;
  }>
> {
  const config = getAliyunConfig();
  const client = getAliyunClient();
  const request = new GetBatchTranslateRequest({
    apiType: config.batchApiType,
    formatType: config.formatType,
    scene: config.scene,
    sourceLanguage: input.sourceLanguage,
    sourceText: JSON.stringify(
      Object.fromEntries(
        input.batch.segments.map((segment) => [segment.id, segment.normalizedText])
      )
    ),
    targetLanguage: input.targetLanguage,
  });
  const response = await client.getBatchTranslate(request);
  const translatedList = response.body?.translatedList;

  if (!Array.isArray(translatedList)) {
    throw new Error(response.body?.message || "Aliyun batch translate returned empty result");
  }

  const translatedBySegmentId = new Map<string, string>();
  for (const item of translatedList) {
    const indexValue = item?.index ?? item?.Index;
    const translatedValue = item?.translated ?? item?.Translated;
    const codeValue = item?.code ?? item?.Code ?? "200";
    const segmentId = typeof indexValue === "string" ? indexValue : null;
    const translatedText = typeof translatedValue === "string" ? translatedValue.trim() : null;
    const code = String(codeValue);

    if (!segmentId || !translatedText) {
      throw new Error("Aliyun batch translate returned malformed segment payload");
    }

    if (code !== "200") {
      throw new Error(
        `Aliyun batch translate returned non-success code for segment ${segmentId}: ${code}`
      );
    }

    translatedBySegmentId.set(segmentId, translatedText);
  }

  if (translatedBySegmentId.size !== input.batch.segments.length) {
    throw new Error("Aliyun batch translate returned incomplete segment results");
  }

  return input.batch.segments.map((segment) => {
    const translatedText = translatedBySegmentId.get(segment.id);
    if (translatedText === undefined) {
      throw new Error(`Aliyun batch translate missing result for segment ${segment.id}`);
    }

    return {
      sourceSegmentId: segment.id,
      orderIndex: segment.orderIndex,
      textTranslated: translatedText,
    };
  });
}

async function translateSingleSegmentWithAliyun(input: {
  sourceLanguage: string;
  targetLanguage: string;
  segment: SingleTranslationPlanItem;
}): Promise<{
  sourceSegmentId: string;
  orderIndex: number;
  textTranslated: string;
}> {
  const translated = await translateTextWithAliyun({
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    text: input.segment.normalizedText,
  });

  return {
    sourceSegmentId: input.segment.id,
    orderIndex: input.segment.orderIndex,
    textTranslated: translated,
  };
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(items[index], index);
      }
    })
  );

  return results;
}

async function updateTranslationProcessingState(
  transcriptionJobId: string,
  targetLanguage: string,
  sourceLanguage: string,
  sourceDisplayVersion: number
): Promise<TranscriptionTranslationJob> {
  const now = new Date();
  const existing = await db.query.transcriptionTranslationJobs.findFirst({
    where: and(
      eq(transcriptionTranslationJobs.transcriptionJobId, transcriptionJobId),
      eq(transcriptionTranslationJobs.targetLanguage, targetLanguage)
    ),
  });

  if (existing) {
    const [updated] = await db
      .update(transcriptionTranslationJobs)
      .set({
        sourceLanguage,
        status: "processing",
        sourceDisplayVersion,
        provider: DEFAULT_PROVIDER,
        model: DEFAULT_MODEL,
        errorMessage: null,
        updatedAt: now,
      })
      .where(eq(transcriptionTranslationJobs.id, existing.id))
      .returning();

    if (!updated) {
      throw new Error("Failed to update translation job");
    }

    await db
      .delete(transcriptionTranslationSegments)
      .where(eq(transcriptionTranslationSegments.translationJobId, updated.id));

    return updated;
  }

  const [created] = await db
    .insert(transcriptionTranslationJobs)
    .values({
      transcriptionJobId,
      targetLanguage,
      sourceLanguage,
      status: "processing",
      sourceDisplayVersion,
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      updatedAt: now,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create translation job");
  }

  return created;
}

async function markTranslationFailed(
  translationJobId: string,
  message: string
): Promise<void> {
  await db
    .update(transcriptionTranslationJobs)
    .set({
      status: "failed",
      errorMessage: message,
      updatedAt: new Date(),
    })
    .where(eq(transcriptionTranslationJobs.id, translationJobId));
}

async function publishTranslationUpdate(
  job: TranscriptionJob,
  completedTranslation?: TranscriptionTranslationClientData | null
): Promise<{ inline: boolean; serializedBytes: number } | null> {
  const task = await serializeTranscriptionJob(job);
  const aiArtifacts =
    (await serializeTranscriptionAiArtifacts(job.id, job.displayVersion)) ??
    buildEmptyArtifacts();
  const translations = await serializeTranscriptionTranslations(job.id, job.displayVersion);
  const serializedBytes = completedTranslation
    ? Buffer.byteLength(
        JSON.stringify({
          type: "transcription.updated",
          task,
          aiArtifacts,
          translations,
          completedTranslation,
        }),
        "utf8"
      )
    : 0;
  const inline =
    Boolean(completedTranslation) && serializedBytes <= MAX_INLINE_TRANSLATION_EVENT_BYTES;

  await publishTranscriptionRealtimeUpdate(
    task,
    job.userId,
    aiArtifacts,
    translations,
    inline ? completedTranslation : null
  );

  return completedTranslation ? { inline, serializedBytes } : null;
}

export async function requestTranscriptionTranslation(input: {
  job: TranscriptionJob;
  targetLanguage: string;
  force?: boolean;
}): Promise<CreateTranslationRequestResult> {
  const targetLanguage = normalizeLanguageCode(input.targetLanguage);
  const existing = await db.query.transcriptionTranslationJobs.findFirst({
    where: and(
      eq(transcriptionTranslationJobs.transcriptionJobId, input.job.id),
      eq(transcriptionTranslationJobs.targetLanguage, targetLanguage)
    ),
  });

  if (
    existing &&
    !input.force &&
    existing.status === "completed" &&
    existing.sourceDisplayVersion === input.job.displayVersion
  ) {
    return {
      translation: mapTranslationRowToClientData(existing, input.job.displayVersion, null),
      queued: false,
    };
  }

  if (
    existing &&
    !input.force &&
    existing.status === "processing" &&
    existing.sourceDisplayVersion === input.job.displayVersion
  ) {
    return {
      translation: mapTranslationRowToClientData(existing, input.job.displayVersion, null),
      queued: false,
    };
  }

  const processing = await updateTranslationProcessingState(
    input.job.id,
    targetLanguage,
    normalizeSourceLanguage(input.job.language),
    input.job.displayVersion
  );

  await publishTranslationUpdate(input.job);

  void generateTranscriptionTranslation(input.job.publicId, targetLanguage).catch((error) => {
    console.error("[Transcriptions] Translation generation failed", {
      publicId: input.job.publicId,
      targetLanguage,
      error,
    });
  });

  return {
    translation: mapTranslationRowToClientData(processing, input.job.displayVersion, null),
    queued: true,
  };
}

export async function generateTranscriptionTranslation(
  publicId: string,
  targetLanguage: string
): Promise<void> {
  const job = await db.query.transcriptionJobs.findFirst({
    where: eq(transcriptionJobs.publicId, publicId),
  });

  if (!job) {
    throw new Error("Transcription not found");
  }

  const translation = await db.query.transcriptionTranslationJobs.findFirst({
    where: and(
      eq(transcriptionTranslationJobs.transcriptionJobId, job.id),
      eq(transcriptionTranslationJobs.targetLanguage, targetLanguage)
    ),
  });

  if (!translation) {
    throw new Error("Translation job not found");
  }

  const sourceSegments = await loadSourceSegments(job.id);
  if (sourceSegments.length === 0) {
    throw new Error("No display segments available for translation");
  }

  try {
    const sourceLanguage = normalizeSourceLanguage(job.language);
    const executionPlan = buildSegmentBatches(sourceSegments);

    console.info("[Transcriptions] Starting translation generation", {
      publicId,
      targetLanguage,
      sourceLanguage,
      segmentCount: sourceSegments.length,
      batchCount: executionPlan.batches.length,
      singleFallbackCount: executionPlan.singleSegments.length,
      emptySegmentCount: executionPlan.emptySegments.length,
      totalBatchChars: executionPlan.batches.reduce((sum, batch) => sum + batch.charCount, 0),
    });

    const batchResults = await mapWithConcurrency(
      executionPlan.batches,
      BATCH_TRANSLATION_CONCURRENCY,
      async (batch) => {
        console.info("[Transcriptions] Executing translation batch", {
          publicId,
          targetLanguage,
          batchIndex: batch.batchIndex,
          segmentCount: batch.segments.length,
          charCount: batch.charCount,
        });

        return translateBatchWithAliyun({
          sourceLanguage,
          targetLanguage,
          batch,
        });
      }
    );

    const singleResults = await mapWithConcurrency(
      executionPlan.singleSegments,
      SINGLE_TRANSLATION_CONCURRENCY,
      async (segment) => {
        console.info("[Transcriptions] Executing single-segment translation fallback", {
          publicId,
          targetLanguage,
          orderIndex: segment.orderIndex,
          charCount: segment.charCount,
        });

        return translateSingleSegmentWithAliyun({
          sourceLanguage,
          targetLanguage,
          segment,
        });
      }
    );

    const translatedSegments = [
      ...executionPlan.emptySegments,
      ...batchResults.flat(),
      ...singleResults,
    ].sort((left, right) => left.orderIndex - right.orderIndex);

    await db.transaction(async (tx) => {
      await tx
        .delete(transcriptionTranslationSegments)
        .where(eq(transcriptionTranslationSegments.translationJobId, translation.id));

      await tx.insert(transcriptionTranslationSegments).values(
        translatedSegments.map((segment) => ({
          translationJobId: translation.id,
          sourceSegmentId: segment.sourceSegmentId,
          orderIndex: segment.orderIndex,
          textTranslated: segment.textTranslated,
        }))
      );

      await tx
        .update(transcriptionTranslationJobs)
        .set({
          status: "completed",
          errorMessage: null,
          generatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(transcriptionTranslationJobs.id, translation.id));
    });

    console.info("[Transcriptions] Translation generation completed", {
      publicId,
      targetLanguage,
      translatedSegmentCount: translatedSegments.length,
      batchCount: executionPlan.batches.length,
      singleFallbackCount: executionPlan.singleSegments.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Translation failed";
    await markTranslationFailed(translation.id, message);
    console.error("[Transcriptions] Translation job failed", {
      publicId,
      targetLanguage,
      message,
    });
  }

  const refreshedJob = await db.query.transcriptionJobs.findFirst({
    where: eq(transcriptionJobs.id, job.id),
  });

  if (refreshedJob) {
    const refreshedTranslation = await db.query.transcriptionTranslationJobs.findFirst({
      where: and(
        eq(transcriptionTranslationJobs.transcriptionJobId, refreshedJob.id),
        eq(transcriptionTranslationJobs.targetLanguage, targetLanguage)
      ),
    });

    const completedTranslation =
      refreshedTranslation?.status === "completed"
        ? await getTranscriptionTranslationDetailByJob(
            refreshedTranslation,
            refreshedJob.displayVersion
          )
        : null;

    if (completedTranslation) {
      const delivery = await publishTranslationUpdate(
        refreshedJob,
        completedTranslation
      );

      console.info("[Transcriptions] Translation completion delivery", {
        publicId,
        targetLanguage,
        segmentCount: completedTranslation.segments?.length ?? 0,
        serializedBytes: delivery?.serializedBytes ?? 0,
        delivery: delivery?.inline ? "inline" : "detail_fetch",
      });
      return;
    }

    await publishTranslationUpdate(refreshedJob);
  }
}
