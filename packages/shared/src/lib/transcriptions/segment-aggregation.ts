import type {
  TranscriptionSegment,
  TranscriptionWord,
} from "@markless/shared/src/types/transcriptions";

export type TranscriptionDisplayAggregationOptions = {
  language?: string | null;
  pauseSplitMs?: number;
  maxDurationMs?: number;
  maxWords?: number;
  cjkMaxChars?: number;
  nonSpaceMaxChars?: number;
};

type AggregationThresholds = Required<
  Omit<TranscriptionDisplayAggregationOptions, "language">
> & {
  language: string | null;
};

type DisplayBlockState = {
  startIndex: number;
  endIndex: number;
  speaker: string | null;
  rawSpeaker: string | null;
  startMs: number;
  endMs: number;
  text: string;
  words: TranscriptionWord[];
  avgLogprobSum: number;
  avgLogprobCount: number;
};

const DEFAULT_THRESHOLDS: AggregationThresholds = {
  language: null,
  pauseSplitMs: 1500,
  maxDurationMs: 26000,
  maxWords: 80,
  cjkMaxChars: 140,
  nonSpaceMaxChars: 220,
};

const CJK_LANGUAGE_PREFIXES = [
  "zh",
  "ja",
  "ko",
];

const CJK_CHAR_PATTERN =
  /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/u;

const SPACE_SEPARATED_WORD_PATTERN = /[^\s]+/g;

function normalizeSpeakerValue(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function isUnknownSpeakerValue(value: string | null | undefined): boolean {
  const normalized = normalizeSpeakerValue(value);
  return normalized !== null && normalized.toUpperCase() === "UNKNOWN";
}

function normalizeLanguage(language: string | null | undefined): string | null {
  if (typeof language !== "string") {
    return null;
  }

  const normalized = language.trim().toLowerCase();
  return normalized || null;
}

function isCjkLanguage(language: string | null): boolean {
  return Boolean(
    language &&
      CJK_LANGUAGE_PREFIXES.some((prefix) => language === prefix || language.startsWith(`${prefix}-`))
  );
}

function countSpaceSeparatedWords(text: string): number {
  const matches = text.match(SPACE_SEPARATED_WORD_PATTERN);
  return matches ? matches.length : 0;
}

function countCjkChars(text: string): number {
  let count = 0;

  for (const char of text) {
    if (CJK_CHAR_PATTERN.test(char)) {
      count += 1;
    }
  }

  return count;
}

function isMostlyCjkText(text: string): boolean {
  if (!text.trim()) {
    return false;
  }

  const cjkCount = countCjkChars(text);
  if (cjkCount === 0) {
    return false;
  }

  const compactLength = text.replace(/\s+/g, "").length;
  return compactLength > 0 && cjkCount / compactLength >= 0.4;
}

function shouldUseCjkLimit(text: string, language: string | null): boolean {
  return isCjkLanguage(language) || isMostlyCjkText(text);
}

function exceedsTextHardLimit(
  text: string,
  thresholds: AggregationThresholds
): boolean {
  if (shouldUseCjkLimit(text, thresholds.language)) {
    return countCjkChars(text) > thresholds.cjkMaxChars;
  }

  const wordCount = countSpaceSeparatedWords(text);
  if (wordCount > 0) {
    return wordCount > thresholds.maxWords;
  }

  return text.replace(/\s+/g, "").length > thresholds.nonSpaceMaxChars;
}

function joinSegmentText(left: string, right: string): string {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  const leftEndsWithCjk = CJK_CHAR_PATTERN.test(left[left.length - 1] || "");
  const rightStartsWithCjk = CJK_CHAR_PATTERN.test(right[0] || "");

  if (leftEndsWithCjk || rightStartsWithCjk) {
    return `${left}${right}`;
  }

  return `${left} ${right}`;
}

function sanitizeWords(value: unknown): TranscriptionWord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((word) => {
    if (!word || typeof word !== "object") {
      return [];
    }

    const candidate = word as Partial<TranscriptionWord>;
    if (
      typeof candidate.text !== "string" ||
      typeof candidate.startMs !== "number" ||
      typeof candidate.endMs !== "number"
    ) {
      return [];
    }

    return [
      {
        startMs: candidate.startMs,
        endMs: candidate.endMs,
        text: candidate.text,
        speaker: typeof candidate.speaker === "string" ? candidate.speaker : null,
        probability:
          typeof candidate.probability === "number"
            ? candidate.probability
            : null,
      },
    ];
  });
}

const SENTENCE_END_PATTERN = /[.!?。？！]$/u;
const WEAK_END_PATTERN = /[;；:：]$/u;

function wordSpeaker(word: TranscriptionWord): string | null {
  const value = normalizeSpeakerValue(word.speaker);
  return value && !isUnknownSpeakerValue(value) ? value : null;
}

const NO_SPACE_BEFORE_TOKEN_PATTERN = /^[,.;:!?%°，。！？；：、）》】》〉」』”’)]/u;
const NO_SPACE_AFTER_TOKEN_PATTERN = /[(（【《〈「『“‘]$/u;
const TOKEN_JOINER_PATTERN = /[-–—/'’‘]$/u;
const TOKEN_JOINER_PREFIX_PATTERN = /^[-–—/'’‘]/u;

function isCjkChar(value: string): boolean {
  return CJK_CHAR_PATTERN.test(value);
}

function shouldInsertTokenSpace(previous: string, current: string): boolean {
  if (!previous || !current) {
    return false;
  }

  if (NO_SPACE_BEFORE_TOKEN_PATTERN.test(current)) {
    return false;
  }

  if (NO_SPACE_AFTER_TOKEN_PATTERN.test(previous)) {
    return false;
  }

  if (
    TOKEN_JOINER_PATTERN.test(previous) ||
    TOKEN_JOINER_PREFIX_PATTERN.test(current)
  ) {
    return false;
  }

  const previousLast = previous.at(-1) ?? "";
  const currentFirst = current[0] ?? "";

  return !(isCjkChar(previousLast) && isCjkChar(currentFirst));
}

function joinTranscriptTokens(tokens: string[]): string {
  let result = "";

  for (const rawToken of tokens) {
    const token = rawToken.trim();
    if (!token) {
      continue;
    }

    if (!result) {
      result = token;
      continue;
    }

    result += shouldInsertTokenSpace(result, token) ? ` ${token}` : token;
  }

  return result;
}

function joinWords(words: TranscriptionWord[]): string {
  return joinTranscriptTokens(words.map((word) => word.text));
}

function hasUsableWords(segment: TranscriptionSegment): boolean {
  return Boolean(segment.words?.some((word) => word.text.trim() && word.endMs >= word.startMs));
}

function smoothWordSpeakers(words: TranscriptionWord[]): TranscriptionWord[] {
  const result = words.map((word) => ({ ...word }));
  for (let index = 1; index < result.length - 1; index += 1) {
    const previous = wordSpeaker(result[index - 1]);
    const current = wordSpeaker(result[index]);
    const next = wordSpeaker(result[index + 1]);
    if (current && previous && previous === next && current !== previous) {
      result[index].speaker = previous;
    }
  }
  return result;
}

function splitWordsIntoDisplaySegments(
  words: Array<TranscriptionWord & { sourceIndex?: number }>,
  language: string | null
): TranscriptionSegment[] {
  const result: TranscriptionSegment[] = [];
  let current: Array<TranscriptionWord & { sourceIndex?: number }> = [];
  let currentSpeaker: string | null = null;
  let lastNaturalBoundaryIndex: number | null = null;
  const cjk = shouldUseCjkLimit(words.map((word) => word.text).join(""), language);
  const maxWords = cjk ? Number.POSITIVE_INFINITY : 140;
  const maxChars = cjk ? 260 : Number.POSITIVE_INFINITY;

  const flush = (count = current.length) => {
    if (!current.length || count <= 0) return;
    const completed = current.slice(0, count);
    result.push({
      id: `segment_${result.length + 1}`,
      speaker: currentSpeaker,
      rawSpeaker: currentSpeaker,
      startMs: completed[0].startMs,
      endMs: completed[completed.length - 1].endMs,
      text: joinWords(completed),
      words: [...completed],
      sourceStartIndex: completed[0].sourceIndex ?? 0,
      sourceEndIndex: completed[completed.length - 1].sourceIndex ?? completed[0].sourceIndex ?? 0,
    });
    current = current.slice(count);
    lastNaturalBoundaryIndex = null;
    if (!current.length) currentSpeaker = null;
  };

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    const detectedSpeaker = wordSpeaker(word);
    const previousSpeaker = currentSpeaker;
    const pauseMs = current.length ? word.startMs - current[current.length - 1].endMs : 0;
    const candidateSpeakerChange = current.length > 0 && detectedSpeaker && previousSpeaker && detectedSpeaker !== previousSpeaker;
    const nextSpeaker = index + 1 < words.length ? wordSpeaker(words[index + 1]) : null;
    const confirmedSpeakerChange = candidateSpeakerChange && nextSpeaker === detectedSpeaker;
    const speaker = candidateSpeakerChange && !confirmedSpeakerChange ? previousSpeaker : detectedSpeaker;

    if (confirmedSpeakerChange) {
      flush();
      currentSpeaker = detectedSpeaker;
    }
    const currentDurationBeforeWord = current.length
      ? current[current.length - 1].endMs - current[0].startMs
      : 0;
    if (
      pauseMs >= 1500 &&
      current.length > 0 &&
      currentDurationBeforeWord >= 24000 &&
      lastNaturalBoundaryIndex === null
    ) {
      lastNaturalBoundaryIndex = current.length;
    }
    if (!current.length) currentSpeaker = speaker ?? currentSpeaker;
    current.push(word);

    const text = joinWords(current);
    const sentenceEnd = SENTENCE_END_PATTERN.test(word.text.trim());
    const weakEnd = WEAK_END_PATTERN.test(word.text.trim());
    const durationMs = current[current.length - 1].endMs - current[0].startMs;
    if (sentenceEnd && durationMs >= 24000) {
      lastNaturalBoundaryIndex = current.length;
    }
    const overHardLimit = durationMs >= 45000 || current.length >= maxWords || text.replace(/\s+/g, "").length >= maxChars;
    const reachedSoftLimit = durationMs >= 30000 || (!cjk && current.length >= 90) || (cjk && text.replace(/\s+/g, "").length >= 200);
    const nextGap = index + 1 < words.length ? words[index + 1].startMs - word.endMs : 0;
    if (overHardLimit) {
      flush(lastNaturalBoundaryIndex ?? current.length);
    } else if (reachedSoftLimit && lastNaturalBoundaryIndex !== null) {
      flush(lastNaturalBoundaryIndex);
    } else if (weakEnd && reachedSoftLimit && nextGap >= 300) {
      flush();
    }
  }
  flush();
  return result;
}

function canMergeShortTail(
  previous: TranscriptionSegment,
  next: TranscriptionSegment,
  language: string | null
): boolean {
  if (previous.speaker !== next.speaker) {
    return false;
  }

  const pauseMs = Math.max(0, next.startMs - previous.endMs);
  const previousDurationMs = Math.max(0, previous.endMs - previous.startMs);
  const nextDurationMs = Math.max(0, next.endMs - next.startMs);
  const mergedDurationMs = Math.max(0, next.endMs - previous.startMs);
  if (
    pauseMs >= 1500 ||
    previousDurationMs < 24000 ||
    nextDurationMs >= 15000 ||
    mergedDurationMs > 45000
  ) {
    return false;
  }

  const mergedText = joinSegmentText(previous.text, next.text);
  if (shouldUseCjkLimit(mergedText, language)) {
    return countCjkChars(mergedText) <= 260;
  }

  return countSpaceSeparatedWords(mergedText) <= 140;
}

function mergeDisplaySegments(
  previous: TranscriptionSegment,
  next: TranscriptionSegment
): TranscriptionSegment {
  return {
    ...previous,
    endMs: next.endMs,
    text: joinSegmentText(previous.text, next.text),
    words: [...(previous.words ?? []), ...(next.words ?? [])],
    sourceEndIndex: next.sourceEndIndex ?? previous.sourceEndIndex,
  };
}

function mergeShortDisplaySegmentTails(
  segments: TranscriptionSegment[],
  language: string | null
): TranscriptionSegment[] {
  return segments.reduce<TranscriptionSegment[]>((result, segment) => {
    const previous = result[result.length - 1];
    if (previous && canMergeShortTail(previous, segment, language)) {
      result[result.length - 1] = mergeDisplaySegments(previous, segment);
      return result;
    }

    result.push(segment);
    return result;
  }, []);
}

export function buildWordBasedDisplaySegments(
  rawSegments: TranscriptionSegment[],
  options: { language?: string | null } = {}
): TranscriptionSegment[] {
  const result: TranscriptionSegment[] = [];
  const language = normalizeLanguage(options.language ?? null);
  let wordRun: Array<TranscriptionWord & { sourceIndex: number }> = [];
  const flushWordRun = () => {
    if (!wordRun.length) return;
    const normalized = smoothWordSpeakers(wordRun);
    result.push(...splitWordsIntoDisplaySegments(normalized, language));
    wordRun = [];
  };

  for (let index = 0; index < rawSegments.length; index += 1) {
    const segment = rawSegments[index];
    if (!hasUsableWords(segment)) {
      flushWordRun();
      result.push(segment);
      continue;
    }
    for (const word of segment.words ?? []) {
      if (word.text.trim() && word.endMs >= word.startMs) {
        wordRun.push({
          ...word,
          speaker: word.speaker ?? segment.speaker ?? null,
          sourceIndex: index,
        });
      }
    }
  }
  flushWordRun();
  return mergeShortDisplaySegmentTails(result, language);
}

export function coerceTranscriptionSegments(value: unknown): TranscriptionSegment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((segment, index) => {
    if (!segment || typeof segment !== "object") {
      return [];
    }

    const candidate = segment as Partial<TranscriptionSegment>;
    if (
      typeof candidate.startMs !== "number" ||
      typeof candidate.endMs !== "number" ||
      typeof candidate.text !== "string"
    ) {
      return [];
    }

    return [
      {
        id:
          typeof candidate.id === "string" && candidate.id.trim()
            ? candidate.id
            : `segment_${index + 1}`,
        speaker:
          normalizeSpeakerValue(candidate.speaker) &&
          !isUnknownSpeakerValue(candidate.speaker)
            ? normalizeSpeakerValue(candidate.speaker)
            : null,
        rawSpeaker: normalizeSpeakerValue(
          candidate.rawSpeaker ?? candidate.speaker ?? null
        ),
        startMs: candidate.startMs,
        endMs: candidate.endMs,
        text: candidate.text.trim(),
        avgLogprob:
          typeof candidate.avgLogprob === "number" ? candidate.avgLogprob : null,
        words: sanitizeWords(candidate.words),
      },
    ];
  });
}

function getKnownSpeaker(segment: TranscriptionSegment): string | null {
  const displaySpeaker = normalizeSpeakerValue(segment.speaker);
  if (displaySpeaker && !isUnknownSpeakerValue(displaySpeaker)) {
    return displaySpeaker;
  }

  const rawSpeaker = normalizeSpeakerValue(segment.rawSpeaker);
  if (rawSpeaker && !isUnknownSpeakerValue(rawSpeaker)) {
    return rawSpeaker;
  }

  return null;
}

function resolveUnknownSpeakerSegments(
  segments: TranscriptionSegment[],
  pauseSplitMs: number
): TranscriptionSegment[] {
  const knownSpeakers = segments.map(getKnownSpeaker);

  return segments.map((segment, index) => {
    const knownSpeaker = knownSpeakers[index];
    if (knownSpeaker) {
      return {
        ...segment,
        speaker: knownSpeaker,
      };
    }

    const previousKnownSpeaker = index > 0 ? knownSpeakers[index - 1] : null;
    const nextKnownSpeaker =
      index < knownSpeakers.length - 1 ? knownSpeakers[index + 1] : null;

    if (
      previousKnownSpeaker &&
      nextKnownSpeaker &&
      previousKnownSpeaker === nextKnownSpeaker
    ) {
      return {
        ...segment,
        speaker: previousKnownSpeaker,
      };
    }

    const durationMs = Math.max(0, segment.endMs - segment.startMs);
    const pauseFromPreviousMs =
      index > 0 ? Math.max(0, segment.startMs - segments[index - 1].endMs) : Infinity;

    if (
      previousKnownSpeaker &&
      durationMs <= 5000 &&
      pauseFromPreviousMs <= pauseSplitMs
    ) {
      return {
        ...segment,
        speaker: previousKnownSpeaker,
      };
    }

    return {
      ...segment,
      speaker: null,
    };
  });
}

function createBlockState(
  segment: TranscriptionSegment,
  index: number
): DisplayBlockState {
  return {
    startIndex: index,
    endIndex: index,
    speaker: segment.speaker,
    rawSpeaker: segment.rawSpeaker ?? segment.speaker ?? null,
    startMs: segment.startMs,
    endMs: segment.endMs,
    text: segment.text,
    words: segment.words ?? [],
    avgLogprobSum: typeof segment.avgLogprob === "number" ? segment.avgLogprob : 0,
    avgLogprobCount: typeof segment.avgLogprob === "number" ? 1 : 0,
  };
}

function appendToBlock(
  block: DisplayBlockState,
  segment: TranscriptionSegment,
  index: number
): DisplayBlockState {
  const nextRawSpeaker =
    block.rawSpeaker &&
    (segment.rawSpeaker ?? segment.speaker ?? null) === block.rawSpeaker
      ? block.rawSpeaker
      : null;

  return {
    ...block,
    endIndex: index,
    endMs: segment.endMs,
    rawSpeaker: nextRawSpeaker,
    text: joinSegmentText(block.text, segment.text),
    words: [...block.words, ...(segment.words ?? [])],
    avgLogprobSum:
      block.avgLogprobSum +
      (typeof segment.avgLogprob === "number" ? segment.avgLogprob : 0),
    avgLogprobCount:
      block.avgLogprobCount +
      (typeof segment.avgLogprob === "number" ? 1 : 0),
  };
}

function finalizeBlock(block: DisplayBlockState): TranscriptionSegment {
  return {
    id: `display_segment_${block.startIndex + 1}_${block.endIndex + 1}`,
    speaker: block.speaker,
    rawSpeaker: block.rawSpeaker,
    startMs: block.startMs,
    endMs: block.endMs,
    text: block.text,
    avgLogprob:
      block.avgLogprobCount > 0
        ? block.avgLogprobSum / block.avgLogprobCount
        : null,
    words: block.words,
    sourceStartIndex: block.startIndex,
    sourceEndIndex: block.endIndex,
  };
}

export function aggregateTranscriptionDisplaySegments(
  rawSegments: TranscriptionSegment[],
  options: TranscriptionDisplayAggregationOptions = {}
): TranscriptionSegment[] {
  if (rawSegments.length === 0) {
    return [];
  }

  const thresholds: AggregationThresholds = {
    ...DEFAULT_THRESHOLDS,
    ...options,
    language: normalizeLanguage(options.language ?? null),
  };

  const resolvedSegments = resolveUnknownSpeakerSegments(
    rawSegments,
    thresholds.pauseSplitMs
  );
  const result: TranscriptionSegment[] = [];

  // This profile is tuned for reading-oriented transcript blocks such as
  // podcasts, interviews, and async audio/video review pages. It is not
  // intended for subtitle timing, live captions, or highly granular turn-taking.
  // Unknown diarization labels are resolved conservatively to avoid exposing
  // raw "UNKNOWN" markers while still preserving rawSpeaker for traceability.
  let current = createBlockState(resolvedSegments[0], 0);

  for (let index = 1; index < resolvedSegments.length; index += 1) {
    const next = resolvedSegments[index];
    const speakerChanged = current.speaker !== next.speaker;
    const pauseMs = Math.max(0, next.startMs - current.endMs);

    if (speakerChanged || pauseMs > thresholds.pauseSplitMs) {
      result.push(finalizeBlock(current));
      current = createBlockState(next, index);
      continue;
    }

    const mergedDurationMs = next.endMs - current.startMs;
    const mergedText = joinSegmentText(current.text, next.text);
    const exceedsDuration = mergedDurationMs > thresholds.maxDurationMs;
    const exceedsText = exceedsTextHardLimit(mergedText, thresholds);

    if (exceedsDuration || exceedsText) {
      result.push(finalizeBlock(current));
      current = createBlockState(next, index);
      continue;
    }

    current = appendToBlock(current, next, index);
  }

  result.push(finalizeBlock(current));
  return result;
}
