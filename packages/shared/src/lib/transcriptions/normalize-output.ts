import type { TranscriptionSegment } from "@markless/shared/src/types/transcriptions";

type NormalizedTranscriptionOutput = {
  language: string | null;
  speakerCount: number | null;
  durationMs: number | null;
  segments: TranscriptionSegment[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

function toMs(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return Math.round(numeric * 1000);
}

function resolveRawSpeaker(record: Record<string, unknown>): string | null {
  const candidates = [
    record.speaker,
    record.speaker_id,
    record.speaker_label,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  if (typeof record.speaker === "number" && Number.isFinite(record.speaker)) {
    return `Speaker ${record.speaker}`;
  }

  return null;
}

function resolveDisplaySpeaker(rawSpeaker: string | null): string | null {
  if (!rawSpeaker) {
    return null;
  }

  return rawSpeaker.trim().toUpperCase() === "UNKNOWN" ? null : rawSpeaker;
}

function normalizeWords(record: Record<string, unknown>) {
  const rawWords = Array.isArray(record.words) ? record.words : [];
  return rawWords
    .map((word) => {
      if (!isRecord(word)) {
        return null;
      }

      const text =
        typeof word.word === "string"
          ? word.word
          : typeof word.text === "string"
            ? word.text
            : "";

      if (!text.trim()) {
        return null;
      }

      const start = typeof word.start === "number" ? word.start : Number(word.start);
      const end = typeof word.end === "number" ? word.end : Number(word.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) {
        return null;
      }

      return {
        startMs: toMs(start),
        endMs: toMs(end),
        text: text.trim(),
        speaker: resolveDisplaySpeaker(resolveRawSpeaker(word)),
        probability:
          typeof word.probability === "number" ? word.probability : null,
      };
    })
    .filter(isNotNull);
}

export function normalizeReplicateTranscriptionOutput(
  rawOutput: unknown
): NormalizedTranscriptionOutput {
  const root = isRecord(rawOutput) ? rawOutput : {};
  const rawSegments = Array.isArray(root.segments)
    ? root.segments
    : Array.isArray(rawOutput)
      ? rawOutput
      : [];

  const segments: TranscriptionSegment[] = rawSegments
    .map((segment, index) => {
      if (!isRecord(segment)) {
        return null;
      }

      const rawSpeaker = resolveRawSpeaker(segment);

      const text =
        typeof segment.text === "string"
          ? segment.text.trim()
          : typeof segment.segment === "string"
            ? segment.segment.trim()
            : "";

      if (!text) {
        return null;
      }

      return {
        id: `segment_${index + 1}`,
        speaker: resolveDisplaySpeaker(rawSpeaker),
        rawSpeaker,
        startMs: toMs(segment.start),
        endMs: toMs(segment.end),
        text,
        words: normalizeWords(segment),
        avgLogprob:
          typeof segment.avg_logprob === "number" ? segment.avg_logprob : null,
      } satisfies TranscriptionSegment;
    })
    .filter(isNotNull);
  const durationMs =
    segments.length > 0
      ? Math.max(...segments.map((segment) => segment.endMs))
      : null;
  const speakerSet = new Set(
    segments.map((segment) => segment.speaker).filter(Boolean)
  );

  return {
    language: typeof root.language === "string" ? root.language : null,
    speakerCount:
      typeof root.num_speakers === "number"
        ? root.num_speakers
        : speakerSet.size > 0
          ? speakerSet.size
          : null,
    durationMs,
    segments,
  };
}
