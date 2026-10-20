export const TRANSCRIPTION_SPEAKER_DISPLAY_NAME_MAX_LENGTH = 50;

export function normalizeSpeakerDisplayName(value: string): string {
  return value.trim();
}

export function getSpeakerEffectiveLabel(input: {
  displayName: string | null;
  defaultLabel: string;
}): string {
  const normalizedDisplayName = input.displayName?.trim();
  return normalizedDisplayName || input.defaultLabel;
}

export function validateSpeakerDisplayName(value: string): {
  ok: boolean;
  normalized: string;
  error?: "empty" | "too_long";
} {
  const normalized = normalizeSpeakerDisplayName(value);

  if (!normalized) {
    return { ok: false, normalized, error: "empty" };
  }

  if (normalized.length > TRANSCRIPTION_SPEAKER_DISPLAY_NAME_MAX_LENGTH) {
    return { ok: false, normalized, error: "too_long" };
  }

  return { ok: true, normalized };
}
