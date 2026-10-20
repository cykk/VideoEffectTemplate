export const TRANSCRIPTION_DISPLAY_TITLE_MAX_LENGTH = 200;

export function normalizeTranscriptionDisplayTitle(value: string): string {
  return value.trim();
}

export function validateTranscriptionDisplayTitle(value: string): {
  ok: boolean;
  normalized: string;
  error?: "empty" | "too_long";
} {
  const normalized = normalizeTranscriptionDisplayTitle(value);

  if (!normalized) {
    return { ok: false, normalized, error: "empty" };
  }

  if (normalized.length > TRANSCRIPTION_DISPLAY_TITLE_MAX_LENGTH) {
    return { ok: false, normalized, error: "too_long" };
  }

  return { ok: true, normalized };
}
