import type {
  TranscriptionJobClientData,
  TranscriptionTranslationClientData,
  TranscriptionTranslationCollectionClientData,
} from "@markless/shared/src/types/transcriptions";

export type TranslationActionState =
  | "not_created"
  | "processing"
  | "fresh_completed"
  | "stale_completed"
  | "failed";

export const EMPTY_TRANSLATIONS: TranscriptionTranslationCollectionClientData = {};

function isCompletedTranscriptionTask(task: TranscriptionJobClientData | null): boolean {
  return Boolean(task && task.status === "succeeded" && task.stage === "completed");
}

export function shouldWaitForTranslations(
  task: TranscriptionJobClientData | null,
  translations: TranscriptionTranslationCollectionClientData
): boolean {
  if (!isCompletedTranscriptionTask(task)) {
    return false;
  }

  return Object.values(translations).some(
    (translation) => translation.status === "processing"
  );
}

export function getTranslationActionState(
  translation: TranscriptionTranslationClientData | null,
  isTranslating: boolean
): TranslationActionState {
  if (isTranslating || translation?.status === "processing") {
    return "processing";
  }

  if (!translation) {
    return "not_created";
  }

  if (translation.status === "failed") {
    return "failed";
  }

  if (translation.status === "completed") {
    return translation.isStale ? "stale_completed" : "fresh_completed";
  }

  return "not_created";
}

export function hasCompletedTranslationSegments(
  translation: TranscriptionTranslationClientData | null | undefined
): boolean {
  return translation?.status === "completed" && Boolean(translation.segments?.length);
}

export function resolveTranslationDisplayLanguage(input: {
  targetLanguage: string;
  pendingTranslationLanguage: string | null;
  displayedTranslationLanguage: string | null;
  translationDisplayMode: "original" | "translation";
}): string | null {
  if (input.translationDisplayMode !== "translation") {
    return input.displayedTranslationLanguage;
  }

  if (
    input.pendingTranslationLanguage === input.targetLanguage ||
    input.displayedTranslationLanguage === input.targetLanguage
  ) {
    return input.targetLanguage;
  }

  return input.displayedTranslationLanguage;
}

export function isAwaitingTranslationContent(input: {
  translationDisplayMode: "original" | "translation";
  targetLanguage: string;
  pendingTranslationLanguage: string | null;
  selectedTranslation: TranscriptionTranslationClientData | null;
  isTranslationInProgress: boolean;
}): boolean {
  if (input.translationDisplayMode !== "translation") {
    return false;
  }

  const isPendingTarget =
    input.pendingTranslationLanguage === input.targetLanguage ||
    input.isTranslationInProgress;

  if (!isPendingTarget) {
    return false;
  }

  return !hasCompletedTranslationSegments(input.selectedTranslation);
}

export function mergeTranslationCollection(
  current: TranscriptionTranslationCollectionClientData,
  incoming: TranscriptionTranslationCollectionClientData,
  completedTranslation?: TranscriptionTranslationClientData | null
): TranscriptionTranslationCollectionClientData {
  const next: TranscriptionTranslationCollectionClientData = { ...current };

  for (const [language, incomingTranslation] of Object.entries(incoming)) {
    const existingTranslation = next[language];

    next[language] =
      existingTranslation?.segments?.length &&
      !incomingTranslation.segments?.length &&
      existingTranslation.updatedAt >= incomingTranslation.updatedAt
        ? existingTranslation
        : incomingTranslation;
  }

  if (completedTranslation) {
    next[completedTranslation.targetLanguage] = completedTranslation;
  }

  return next;
}

