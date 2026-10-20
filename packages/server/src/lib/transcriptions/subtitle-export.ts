export type SubtitleCueInput = {
    startMs: number;
    endMs: number;
    text: string;
    speakerId?: string | null;
    speakerLabel?: string | null;
};

export type SubtitleCue = Omit<SubtitleCueInput, "speakerId">;

export type SubtitleWordCueInput = SubtitleCueInput & {
    words: Array<{
        startMs: number;
        endMs: number;
        text: string;
    }>;
};

export const DEFAULT_MAX_CHARS_PER_CUE = 84;
export const DEFAULT_MAX_DURATION_SECONDS = 6;
export const MIN_MAX_CHARS_PER_CUE = 10;
export const MAX_MAX_CHARS_PER_CUE = 300;
export const MIN_MAX_DURATION_SECONDS = 1;
export const MAX_MAX_DURATION_SECONDS = 30;

const MAX_SEGMENT_GAP_MS = 750;
const MIN_CUE_DURATION_MS = 300;
const MAX_LINES_PER_CUE = 2;
const WORD_BREAK_PAUSE_MS = 500;
const MIN_NATURAL_BREAK_CHARS = 12;
// Keep 42 characters as the preferred line length, but allow a small amount
// of overflow when a natural word boundary cannot land exactly on the target.
const MAX_LINE_LENGTH_OVERFLOW = 4;

export type SubtitleLayoutOptions = {
    maxCharsPerCue: number;
    maxDurationSeconds: number;
};

type SubtitleWindow = {
    startMs: number;
    endMs: number;
    speakerId: string | null;
    speakerLabel: string | null;
    text: string;
};

type TimedSubtitleWord = {
    startMs: number;
    endMs: number;
    text: string;
};

export function normalizeSubtitleLayoutOptions(
    input?: Partial<SubtitleLayoutOptions>,
): SubtitleLayoutOptions {
    const maxCharsPerCue = input?.maxCharsPerCue ?? DEFAULT_MAX_CHARS_PER_CUE;
    const maxDurationSeconds =
        input?.maxDurationSeconds ?? DEFAULT_MAX_DURATION_SECONDS;

    if (
        !Number.isInteger(maxCharsPerCue) ||
        maxCharsPerCue < MIN_MAX_CHARS_PER_CUE ||
        maxCharsPerCue > MAX_MAX_CHARS_PER_CUE
    ) {
        throw new Error(
            `maxCharsPerCue must be an integer between ${MIN_MAX_CHARS_PER_CUE} and ${MAX_MAX_CHARS_PER_CUE}`,
        );
    }
    if (
        !Number.isFinite(maxDurationSeconds) ||
        maxDurationSeconds < MIN_MAX_DURATION_SECONDS ||
        maxDurationSeconds > MAX_MAX_DURATION_SECONDS
    ) {
        throw new Error(
            `maxDurationSeconds must be between ${MIN_MAX_DURATION_SECONDS} and ${MAX_MAX_DURATION_SECONDS}`,
        );
    }

    return { maxCharsPerCue, maxDurationSeconds };
}

function normalizeText(text: string): string {
    return text
        .replace(/\r?\n|\r/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function isCjk(char: string): boolean {
    return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u.test(char);
}

function joinCueText(left: string, right: string): string {
    const leftLast = left.at(-1) ?? "";
    const rightFirst = right[0] ?? "";
    return isCjk(leftLast) || isCjk(rightFirst)
        ? `${left}${right}`
        : `${left} ${right}`;
}

function normalizeInput(input: SubtitleCueInput): SubtitleCueInput | null {
    const text = normalizeText(input.text);
    if (!text) return null;

    const startMs = Math.max(0, Math.floor(input.startMs || 0));
    const endMs = Math.max(
        startMs + MIN_CUE_DURATION_MS,
        Math.floor(input.endMs || 0),
    );
    return {
        ...input,
        startMs,
        endMs,
        text,
        speakerId: input.speakerId ?? null,
        speakerLabel: input.speakerLabel?.trim() || null,
    };
}

/**
 * Display segments are optimized for reading, not subtitle timing. Keep speaker
 * boundaries intact, then build a small same-speaker window before final cue splitting.
 */
function buildSubtitleWindows(
    inputs: SubtitleCueInput[],
    options: SubtitleLayoutOptions,
): SubtitleWindow[] {
    const windows: SubtitleWindow[] = [];
    const maxWindowChars = options.maxCharsPerCue * 2;
    const maxWindowDurationMs = options.maxDurationSeconds * 2000;

    for (const rawInput of inputs) {
        const input = normalizeInput(rawInput);
        if (!input) continue;

        const previous = windows.at(-1);
        if (!previous) {
            windows.push({
                ...input,
                speakerId: input.speakerId ?? null,
                speakerLabel: input.speakerLabel ?? null,
            });
            continue;
        }

        const gapMs = input.startMs - previous.endMs;
        const combinedText = joinCueText(previous.text, input.text);
        const combinedDurationMs = input.endMs - previous.startMs;
        const canAppend =
            previous.speakerId === (input.speakerId ?? null) &&
            gapMs >= 0 &&
            gapMs <= MAX_SEGMENT_GAP_MS &&
            combinedText.length <= maxWindowChars &&
            combinedDurationMs <= maxWindowDurationMs;

        if (canAppend) {
            previous.text = combinedText;
            previous.endMs = input.endMs;
            continue;
        }

        windows.push({
            ...input,
            speakerId: input.speakerId ?? null,
            speakerLabel: input.speakerLabel ?? null,
        });
    }

    return windows;
}

function getPreferredBreak(
    text: string,
    target: number,
    maxChars: number,
): number {
    const upperBound = Math.min(text.length - 1, maxChars);
    const lowerBound = Math.max(1, Math.floor(target * 0.55));
    let bestIndex = -1;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let index = lowerBound; index <= upperBound; index += 1) {
        const before = text[index - 1] ?? "";
        const after = text[index] ?? "";
        const score = Math.abs(index - target);
        const isSentenceBreak = /[.!?\u3002\uff01\uff1f]/u.test(before);
        const isSoftBreak = /[;,:\u3001\uff0c\uff1b\uff1a]/u.test(before);
        const isWordBreak = before === " " || after === " ";

        if (!isSentenceBreak && !isSoftBreak && !isWordBreak) continue;
        const weightedScore =
            score - (isSentenceBreak ? 18 : isSoftBreak ? 8 : 0);
        if (weightedScore < bestScore) {
            bestIndex = index;
            bestScore = weightedScore;
        }
    }

    if (bestIndex > 0) return bestIndex;

    const wordBreak = text.lastIndexOf(" ", upperBound);
    return wordBreak >= lowerBound ? wordBreak : upperBound;
}

function getCueTargetChars(options: SubtitleLayoutOptions): number {
    return Math.ceil(options.maxCharsPerCue / MAX_LINES_PER_CUE);
}

function isCueEndingPunctuation(text: string): boolean {
    return /[.!?\u3002\uff01\uff1f]["'”’）)\]]*$/u.test(text.trim());
}

function isCueSoftEndingPunctuation(text: string): boolean {
    return /[;,:\u3001\uff0c\uff1b\uff1a]["'”’）)\]]*$/u.test(text.trim());
}

function getBestLineBreak(
    text: string,
    maxCharsPerLine: number,
): number | null {
    const softMaxCharsPerLine = maxCharsPerLine + MAX_LINE_LENGTH_OVERFLOW;

    // A short cue is clearer on one line. The soft limit is only used to avoid
    // producing an excessively long single line when a cue must be wrapped.
    if (text.length <= softMaxCharsPerLine) {
        return null;
    }

    const minBreak = Math.max(1, text.length - softMaxCharsPerLine);
    const maxBreak = Math.min(softMaxCharsPerLine, text.length - 1);
    if (minBreak > maxBreak) {
        return null;
    }

    const target = Math.round(text.length / 2);
    let bestIndex = -1;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let index = minBreak; index <= maxBreak; index += 1) {
        const before = text[index - 1] ?? "";
        const after = text[index] ?? "";
        const isSentenceBreak = /[.!?\u3002\uff01\uff1f]/u.test(before);
        const isSoftBreak = /[;,:\u3001\uff0c\uff1b\uff1a]/u.test(before);
        const isWordBreak = before === " " || after === " ";
        const isCjkBreak = isCjk(before) || isCjk(after);

        if (!isSentenceBreak && !isSoftBreak && !isWordBreak && !isCjkBreak) {
            continue;
        }

        const score =
            Math.abs(index - target) -
            (isSentenceBreak ? 18 : 0) -
            (isSoftBreak ? 8 : 0) -
            (isWordBreak ? 3 : 0);
        if (score < bestScore) {
            bestIndex = index;
            bestScore = score;
        }
    }

    return bestIndex > 0 ? bestIndex : null;
}

function formatCueText(text: string, options: SubtitleLayoutOptions): string {
    const normalized = normalizeText(text);
    const lineBreak = getBestLineBreak(normalized, getCueTargetChars(options));
    if (!lineBreak) {
        return normalized;
    }

    const firstLine = normalized.slice(0, lineBreak).trim();
    const secondLine = normalized.slice(lineBreak).trim();
    return firstLine && secondLine ? `${firstLine}\n${secondLine}` : normalized;
}

function splitWindowText(
    text: string,
    cueCount: number,
    maxChars: number,
): string[] {
    const parts: string[] = [];
    let remaining = text;
    let remainingCues = cueCount;

    while (remainingCues > 1) {
        const target = Math.min(
            maxChars,
            Math.ceil(remaining.length / remainingCues),
        );
        const splitAt = getPreferredBreak(remaining, target, maxChars);
        const part = remaining.slice(0, splitAt).trim();
        if (!part) break;

        parts.push(part);
        remaining = remaining.slice(splitAt).trim();
        remainingCues -= 1;
    }

    if (remaining) parts.push(remaining);
    return parts;
}

function countSentenceCues(text: string): number {
    const sentenceParts = text
        .split(/(?<=[.!?\u3002\uff01\uff1f])["'”’）)\]]*(?:\s+|$)/u)
        .map((part) => part.trim())
        .filter(Boolean);

    return sentenceParts.length > 1 &&
        sentenceParts.every((part) => part.length >= MIN_NATURAL_BREAK_CHARS)
        ? sentenceParts.length
        : 1;
}

function buildCuesFromWindow(
    window: SubtitleWindow,
    options: SubtitleLayoutOptions,
): SubtitleCue[] {
    const durationMs = window.endMs - window.startMs;
    const durationCueCount = Math.ceil(
        durationMs / (options.maxDurationSeconds * 1000),
    );
    const textCueCount = Math.ceil(window.text.length / options.maxCharsPerCue);
    const cueCount = Math.max(
        1,
        durationCueCount,
        textCueCount,
        countSentenceCues(window.text),
    );
    const parts = splitWindowText(
        window.text,
        cueCount,
        options.maxCharsPerCue,
    );
    const totalLength =
        parts.reduce((total, part) => total + part.length, 0) || 1;
    let cursor = window.startMs;

    return parts.map((text, index) => {
        const isLast = index === parts.length - 1;
        const proportionalDuration = Math.round(
            durationMs * (text.length / totalLength),
        );
        const endMs = isLast
            ? window.endMs
            : Math.min(
                  window.endMs,
                  Math.max(
                      cursor + MIN_CUE_DURATION_MS,
                      cursor + proportionalDuration,
                  ),
              );
        const cue = {
            startMs: cursor,
            endMs: Math.max(cursor + 1, endMs),
            text: formatCueText(text, options),
            speakerLabel: window.speakerLabel,
        };
        cursor = endMs;
        return cue;
    });
}

function buildCuesFromWords(
    input: SubtitleWordCueInput,
    options: SubtitleLayoutOptions,
): SubtitleCue[] {
    const normalized = normalizeInput(input);
    if (!normalized) {
        return [];
    }

    const words: TimedSubtitleWord[] = input.words
        .map((word) => ({
            startMs: Math.max(0, Math.floor(word.startMs)),
            endMs: Math.max(0, Math.floor(word.endMs)),
            text: word.text.trim(),
        }))
        .filter((word) => word.text && word.endMs >= word.startMs);
    if (!words.length) {
        return [];
    }

    const cues: SubtitleCue[] = [];
    let current: TimedSubtitleWord[] = [];
    const targetChars = getCueTargetChars(options);
    const minimumNaturalBreakChars = Math.max(
        MIN_NATURAL_BREAK_CHARS,
        targetChars,
    );

    const flush = () => {
        if (!current.length) {
            return;
        }

        cues.push({
            startMs: current[0].startMs,
            endMs: Math.max(
                current[0].startMs + MIN_CUE_DURATION_MS,
                current[current.length - 1].endMs,
            ),
            text: formatCueText(
                joinCueTextByWords(current.map((word) => word.text)),
                options,
            ),
            speakerLabel: normalized.speakerLabel ?? null,
        });
        current = [];
    };

    for (let index = 0; index < words.length; index += 1) {
        const word = words[index];
        const candidate = [...current, word];
        const candidateText = joinCueTextByWords(
            candidate.map((item) => item.text),
        );
        const candidateDurationMs = word.endMs - candidate[0].startMs;
        if (
            current.length > 0 &&
            (candidateText.length > options.maxCharsPerCue ||
                candidateDurationMs > options.maxDurationSeconds * 1000)
        ) {
            flush();
        }
        current.push(word);

        const currentText = joinCueTextByWords(
            current.map((item) => item.text),
        );
        const nextWord = words[index + 1];
        const gapAfterWord = nextWord ? nextWord.startMs - word.endMs : 0;
        const canUseNaturalBreak =
            currentText.length >= minimumNaturalBreakChars;

        const shouldBreakAtSentence =
            currentText.length >= MIN_NATURAL_BREAK_CHARS &&
            isCueEndingPunctuation(word.text);
        const shouldBreakAtSoftBoundary =
            canUseNaturalBreak &&
            (isCueSoftEndingPunctuation(word.text) ||
                gapAfterWord >= WORD_BREAK_PAUSE_MS);

        if (shouldBreakAtSentence || shouldBreakAtSoftBoundary) {
            flush();
        }
    }
    flush();
    return cues;
}

export function normalizeSubtitleCues(cues: SubtitleCue[]): SubtitleCue[] {
    return cues.flatMap((cue, index) => {
        const nextCue = cues[index + 1];
        const endMs = nextCue
            ? Math.min(cue.endMs, nextCue.startMs)
            : cue.endMs;

        if (endMs <= cue.startMs) {
            return [];
        }

        return [{ ...cue, endMs }];
    });
}

function joinCueTextByWords(words: string[]): string {
    return words.reduce((text, word) => joinCueText(text, word), "");
}

export function buildSubtitleCues(
    inputs: SubtitleCueInput[],
    options: SubtitleLayoutOptions,
): SubtitleCue[] {
    return normalizeSubtitleCues(
        buildSubtitleWindows(inputs, options).flatMap((window) =>
            buildCuesFromWindow(window, options),
        ),
    );
}

export function buildWordSubtitleCues(
    input: SubtitleWordCueInput,
    options: SubtitleLayoutOptions,
): SubtitleCue[] {
    return normalizeSubtitleCues(buildCuesFromWords(input, options));
}

function formatTimestamp(ms: number, separator: "," | "."): string {
    const safe = Math.max(0, Math.floor(ms));
    const hours = Math.floor(safe / 3600000);
    const minutes = Math.floor((safe % 3600000) / 60000);
    const seconds = Math.floor((safe % 60000) / 1000);
    const millis = safe % 1000;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}${separator}${String(millis).padStart(3, "0")}`;
}

function getCueText(cue: SubtitleCue, showSpeakerNames: boolean): string {
    return showSpeakerNames && cue.speakerLabel
        ? `${cue.speakerLabel}: ${cue.text}`
        : cue.text;
}

export function renderSrt(
    cues: SubtitleCue[],
    showSpeakerNames = false,
): string {
    return `${cues
        .map(
            (cue, index) =>
                `${index + 1}\n${formatTimestamp(cue.startMs, ",")} --> ${formatTimestamp(cue.endMs, ",")}\n${getCueText(cue, showSpeakerNames)}`,
        )
        .join("\n\n")}${cues.length ? "\n" : ""}`;
}

export function renderVtt(
    cues: SubtitleCue[],
    showSpeakerNames = false,
): string {
    return `WEBVTT\n\n${cues
        .map(
            (cue) =>
                `${formatTimestamp(cue.startMs, ".")} --> ${formatTimestamp(cue.endMs, ".")}\n${getCueText(cue, showSpeakerNames)}`,
        )
        .join("\n\n")}${cues.length ? "\n" : ""}`;
}
