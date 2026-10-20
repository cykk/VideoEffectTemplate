import type { TranscriptionUploadSourceType } from "@markless/shared/src/lib/transcriptions/media-formats";

export type TranscriptionUploadAccessMode = "anonymous" | "authenticated";

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

const TRANSCRIPTION_UPLOAD_LIMITS: Record<
  TranscriptionUploadAccessMode,
  Record<TranscriptionUploadSourceType, number>
> = {
  anonymous: {
    audio: 512 * MIB,
    video: GIB,
  },
  authenticated: {
    audio: GIB,
    video: 2 * GIB,
  },
};

export function getTranscriptionUploadMaxFileBytes(input: {
  accessMode: TranscriptionUploadAccessMode;
  sourceType: TranscriptionUploadSourceType;
}): number {
  return TRANSCRIPTION_UPLOAD_LIMITS[input.accessMode][input.sourceType];
}

export function formatTranscriptionUploadFileSizeLimit(bytes: number): string {
  if (bytes >= GIB && bytes % GIB === 0) {
    return `${bytes / GIB} GiB`;
  }

  return `${bytes / MIB} MiB`;
}
