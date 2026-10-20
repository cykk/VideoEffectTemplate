import { and, eq, isNull, lte } from "drizzle-orm";
import { db } from "@markless/server/src/lib/db";
import {
  transcriptionFailureArchives,
  transcriptionJobs,
  type TranscriptionJob,
} from "@markless/server/src/lib/db/schema/transcriptions";
import { deleteFromR2 } from "@markless/server/src/lib/storage/r2-storage";

const METADATA_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;
const MAX_ERROR_MESSAGE_LENGTH = 8_000;
const CLEANUP_BATCH_SIZE = 500;
const MAX_CLEANUP_BATCHES = 20;

type FailureArchiveInput = {
  job: TranscriptionJob;
  failureStage: string;
  errorCode: string;
  errorMessage: string;
};

function normalizeErrorMessage(message: string): string {
  return message.replace(/https?:\/\/[^\s]+/gi, "[redacted-url]").slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

function collectStorageKeys(job: Pick<TranscriptionJob, "sourceR2Key" | "derivedAudioR2Key" | "rawOutputR2Key">): string[] {
  return [...new Set([
    job.sourceR2Key,
    job.derivedAudioR2Key,
    job.rawOutputR2Key,
  ].filter((value): value is string => Boolean(value && value.trim())))];
}

export async function archiveTranscriptionFailure(input: FailureArchiveInput): Promise<void> {
  const now = new Date();

  await db
    .insert(transcriptionFailureArchives)
    .values({
      transcriptionJobId: input.job.id,
      publicId: input.job.publicId,
      userId: input.job.userId,
      ownerType: input.job.userId ? "authenticated" : "anonymous",
      sourceFileName: input.job.sourceFileName,
      sourceContentType: input.job.sourceContentType,
      sourceFileSize: input.job.sourceFileSize,
      sourceDurationMs: input.job.sourceDurationMs,
      processedDurationMs: input.job.processedDurationMs,
      failureStage: input.failureStage,
      errorCode: input.errorCode,
      errorMessage: normalizeErrorMessage(input.errorMessage),
      replicatePredictionId: input.job.replicatePredictionId,
      replicateVersion: input.job.replicateVersion,
      metadataRetainUntil: new Date(now.getTime() + METADATA_RETENTION_MS),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: transcriptionFailureArchives.publicId,
      set: {
        transcriptionJobId: input.job.id,
        failureStage: input.failureStage,
        errorCode: input.errorCode,
        errorMessage: normalizeErrorMessage(input.errorMessage),
        replicatePredictionId: input.job.replicatePredictionId,
        replicateVersion: input.job.replicateVersion,
        updatedAt: now,
      },
    });
}

export async function cleanupExpiredTranscriptionFailureArchives() {
  const now = new Date();
  const deletedIds: string[] = [];
  const failures: Array<{ id: string; reason: string }> = [];
  let scanned = 0;

  for (let batch = 0; batch < MAX_CLEANUP_BATCHES; batch += 1) {
    const records = await db.query.transcriptionFailureArchives.findMany({
      where: lte(transcriptionFailureArchives.metadataRetainUntil, now),
      orderBy: (table, { asc }) => [asc(table.metadataRetainUntil)],
      limit: CLEANUP_BATCH_SIZE,
    });
    if (records.length === 0) break;
    scanned += records.length;

    for (const record of records) {
      try {
        if (record.ownerType === "anonymous") {
          const job = await db.query.transcriptionJobs.findFirst({
            where: and(
              eq(transcriptionJobs.publicId, record.publicId),
              isNull(transcriptionJobs.userId),
              eq(transcriptionJobs.status, "failed")
            ),
            columns: {
              id: true,
              sourceR2Key: true,
              derivedAudioR2Key: true,
              rawOutputR2Key: true,
            },
          });

          if (job) {
            const keys = collectStorageKeys(job);
            const cleanupResults = await Promise.allSettled(keys.map((key) => deleteFromR2(key)));
            const failedKeys = cleanupResults.flatMap((result, index) =>
              result.status === "rejected" ? [keys[index]!] : []
            );

            if (failedKeys.length > 0) {
              throw new Error(`Failed to delete ${failedKeys.length} anonymous failure media object(s)`);
            }

            await db.transaction(async (tx) => {
              await tx.delete(transcriptionJobs).where(eq(transcriptionJobs.id, job.id));
              await tx.delete(transcriptionFailureArchives).where(eq(transcriptionFailureArchives.id, record.id));
            });
          } else {
            await db.delete(transcriptionFailureArchives).where(eq(transcriptionFailureArchives.id, record.id));
          }
        } else {
          await db.delete(transcriptionFailureArchives).where(eq(transcriptionFailureArchives.id, record.id));
        }
        deletedIds.push(record.id);
      } catch (error) {
        failures.push({
          id: record.id,
          reason: error instanceof Error ? error.message : "unknown_error",
        });
      }
    }

    if (records.length < CLEANUP_BATCH_SIZE) break;
  }

  return { scanned, deleted: deletedIds.length, deletedIds, failures };
}
