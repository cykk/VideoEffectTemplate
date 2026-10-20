const DEFAULT_TRANSCRIPTION_CREDITS = 1;
const MS_PER_MINUTE = 60_000;

export function calculateTranscriptionCredits(durationMs: number | null | undefined): number {
  if (!durationMs || !Number.isFinite(durationMs) || durationMs <= 0) {
    return DEFAULT_TRANSCRIPTION_CREDITS;
  }

  return Math.max(DEFAULT_TRANSCRIPTION_CREDITS, Math.ceil(durationMs / MS_PER_MINUTE));
}

export function calculateVerifiedTranscriptionCredits(durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error("Verified transcription duration must be a positive number");
  }

  return Math.max(DEFAULT_TRANSCRIPTION_CREDITS, Math.ceil(durationMs / MS_PER_MINUTE));
}

export function buildTranscriptionChargeIdempotencyKey(publicId: string): string {
  return `transcription:charge:${publicId}`;
}

export function buildTranscriptionRefundIdempotencyKey(publicId: string): string {
  return `transcription:refund:${publicId}`;
}
