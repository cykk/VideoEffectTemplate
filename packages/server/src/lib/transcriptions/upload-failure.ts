import { db } from "@markless/server/src/lib/db";
import { transcriptionUploadFailures } from "@markless/server/src/lib/db/schema/transcriptions";

const MAX_ERROR_MESSAGE_LENGTH = 2000;

function normalizeMessage(message: string): string {
  return message
    .replace(/https?:\/\/[^\s]+/gi, "[redacted-url]")
    .replace(/(authorization|x-amz-[\w-]+|access[_-]?key|secret)[=:]\s*[^\s,]+/gi, "$1=[redacted]")
    .slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

export type UploadFailureInput = {
  requestId?: string | null;
  userId?: string | null;
  anonymousSessionId?: string | null;
  sourceType?: string | null;
  fileName?: string | null;
  contentType?: string | null;
  fileSize?: number | null;
  failureStage: "validation" | "file_validation" | "upload_url";
  errorCode: string;
  errorMessage: string;
};

export async function recordTranscriptionUploadFailure(input: UploadFailureInput): Promise<void> {
  try {
    await db.insert(transcriptionUploadFailures).values({
      requestId: input.requestId ?? null,
      userId: input.userId ?? null,
      anonymousSessionId: input.anonymousSessionId ?? null,
      sourceType: input.sourceType ?? null,
      fileName: input.fileName?.slice(0, 512) ?? null,
      contentType: input.contentType?.slice(0, 255) ?? null,
      fileSize: Number.isFinite(input.fileSize) ? input.fileSize : null,
      failureStage: input.failureStage,
      errorCode: input.errorCode,
      errorMessage: normalizeMessage(input.errorMessage),
    });
  } catch (error) {
    console.error("[Transcription Upload Failure] Failed to persist diagnostic record", error);
  }
}
