import type {
  TranscriptionDisplaySegment,
  TranscriptionSegment,
  TranscriptionSpeakerClientData,
  TranscriptionSpeakerColorToken,
} from "@markless/shared/src/types/transcriptions";
import {
  aggregateTranscriptionDisplaySegments,
  buildWordBasedDisplaySegments,
} from "@markless/shared/src/lib/transcriptions/segment-aggregation";

const UNKNOWN_SPEAKER_KEY = "__unknown_speaker__";

const DISPLAY_SPEAKER_COLOR_TOKENS: readonly TranscriptionSpeakerColorToken[] = [
  "emerald",
  "blue",
  "amber",
  "pink",
  "violet",
  "cyan",
  "orange",
  "indigo",
] as const;

export type GeneratedTranscriptionSpeaker = {
  key: string;
  defaultLabel: string;
  colorToken: TranscriptionSpeakerColorToken;
  orderIndex: number;
  isUnknown: boolean;
};

export type GeneratedTranscriptionDisplaySegment = Omit<
  TranscriptionDisplaySegment,
  "speakerId" | "speakerLabel"
> & {
  speakerKey: string;
};

export type GeneratedTranscriptionDisplayProjection = {
  speakers: GeneratedTranscriptionSpeaker[];
  segments: GeneratedTranscriptionDisplaySegment[];
  displayFullText: string | null;
};

function buildDefaultSpeakerLabel(orderIndex: number, speakerCount: number): string {
  return speakerCount <= 1 ? "Speaker" : `Speaker ${orderIndex}`;
}

function normalizeSpeakerKey(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  return normalized.toUpperCase() === "UNKNOWN" ? UNKNOWN_SPEAKER_KEY : normalized;
}

export function getDisplaySpeakerKey(
  segment: Pick<TranscriptionSegment, "speaker" | "rawSpeaker">
): string {
  return (
    normalizeSpeakerKey(segment.speaker) ??
    normalizeSpeakerKey(segment.rawSpeaker) ??
    UNKNOWN_SPEAKER_KEY
  );
}

/**
 * Builds a task-scoped editable transcript projection for meeting and podcast
 * reading views. This keeps original model output intact while generating a
 * stable display layer for segment editing, speaker renaming, playback, and
 * search/replace workflows.
 */
export function buildTranscriptionDisplayProjection(
  rawSegments: TranscriptionSegment[],
  options: {
    language?: string | null;
  } = {}
): GeneratedTranscriptionDisplayProjection {
  const hasWordData = rawSegments.some((segment) => (segment.words?.length ?? 0) > 0);
  const aggregatedSegments = hasWordData
    ? buildWordBasedDisplaySegments(rawSegments, { language: options.language ?? null })
    : aggregateTranscriptionDisplaySegments(rawSegments, { language: options.language ?? null });
  const speakerDrafts: Array<Omit<GeneratedTranscriptionSpeaker, "defaultLabel">> = [];
  const seenSpeakerKeys = new Set<string>();
  const speakers = new Map<string, GeneratedTranscriptionSpeaker>();
  let nextSpeakerOrder = 1;

  for (const segment of aggregatedSegments) {
    const speakerKey = getDisplaySpeakerKey(segment);

    if (seenSpeakerKeys.has(speakerKey)) {
      continue;
    }

    seenSpeakerKeys.add(speakerKey);

    const isUnknown = speakerKey === UNKNOWN_SPEAKER_KEY;
    const colorToken = isUnknown
      ? "slate"
      : DISPLAY_SPEAKER_COLOR_TOKENS[
          (nextSpeakerOrder - 1) % DISPLAY_SPEAKER_COLOR_TOKENS.length
        ];

    speakerDrafts.push({
      key: speakerKey,
      colorToken,
      orderIndex: nextSpeakerOrder,
      isUnknown,
    });
    nextSpeakerOrder += 1;
  }

  const speakerCount = speakerDrafts.length;
  const resolvedSpeakerDrafts =
    speakerCount <= 1
      ? speakerDrafts.map((speaker) => ({
          ...speaker,
          colorToken: "slate" as const,
        }))
      : speakerDrafts;

  for (const speaker of resolvedSpeakerDrafts) {
    speakers.set(speaker.key, {
      ...speaker,
      defaultLabel: buildDefaultSpeakerLabel(speaker.orderIndex, speakerCount),
    });
  }

  const displaySegments: GeneratedTranscriptionDisplaySegment[] = aggregatedSegments.map(
    (segment, index) => {
      const speakerKey = getDisplaySpeakerKey(segment);
      const speaker = speakers.get(speakerKey);

      return {
        id: segment.id,
        speakerId: null,
        speakerKey,
        speakerColorToken: speaker?.colorToken ?? "slate",
        isUnknownSpeaker: speaker?.isUnknown ?? true,
        orderIndex: index + 1,
        sourceStartIndex: segment.sourceStartIndex ?? index,
        sourceEndIndex: segment.sourceEndIndex ?? index,
        startMs: segment.startMs,
        endMs: segment.endMs,
        text: segment.text,
        textOriginal: segment.text,
        isEdited: false,
      };
    }
  );

  return {
    speakers: [...speakers.values()],
    segments: displaySegments,
    displayFullText:
      displaySegments.length > 0
        ? displaySegments.map((segment) => segment.text).join("\n\n")
        : null,
  };
}
