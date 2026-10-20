import { ANONYMOUS_TRANSCRIPTION_RETENTION_MS } from "@markless/shared/src/lib/transcriptions/anonymous-retention";

const ANONYMOUS_ACCESS_TOKENS_STORAGE_KEY =
  "transvio.anonymous.transcription.access_tokens";
const UPLOAD_PREFERENCES_STORAGE_KEY =
  "transvio.transcription.upload_preferences";
const PENDING_CLAIM_STORAGE_KEY =
  "transvio.transcription.pending_claim";

export type TranscriptionAiSummaryPreference = "off" | "general";
export type TranscriptionAiMindMapPreference = "off" | "general";

export type TranscriptionUploadPreferences = {
  aiSummary: TranscriptionAiSummaryPreference;
  aiMindMap: TranscriptionAiMindMapPreference;
  fileName?: string;
};

export type PendingTranscriptionClaim = {
  publicId: string;
  anonymousAccessToken: string;
  createdAt: number;
};

type AnonymousAccessTokenMap = Record<string, string>;
type UploadPreferencesMap = Record<string, TranscriptionUploadPreferences>;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readTokenMap(): AnonymousAccessTokenMap {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(
      ANONYMOUS_ACCESS_TOKENS_STORAGE_KEY
    );
    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue) as AnonymousAccessTokenMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeTokenMap(value: AnonymousAccessTokenMap): void {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(
      ANONYMOUS_ACCESS_TOKENS_STORAGE_KEY,
      JSON.stringify(value)
    );
  } catch {
    // Ignore storage failures in private mode and quota edge cases.
  }
}

export function saveAnonymousTranscriptionAccessToken(
  publicId: string,
  token: string
): void {
  if (!publicId || !token) {
    return;
  }

  const nextMap = readTokenMap();
  nextMap[publicId] = token;
  writeTokenMap(nextMap);
}

export function saveGuestTranscriptionClaimState(
  publicId: string,
  anonymousAccessToken: string
): void {
  if (!publicId || !anonymousAccessToken) {
    return;
  }

  saveAnonymousTranscriptionAccessToken(publicId, anonymousAccessToken);
  savePendingTranscriptionClaim({
    publicId,
    anonymousAccessToken,
    createdAt: Date.now(),
  });
}

export function getAnonymousTranscriptionAccessToken(
  publicId: string
): string | null {
  return readTokenMap()[publicId] ?? null;
}

export function removeAnonymousTranscriptionAccessToken(
  publicId: string
): void {
  if (!publicId) {
    return;
  }

  const nextMap = readTokenMap();
  if (!(publicId in nextMap)) {
    return;
  }

  delete nextMap[publicId];
  writeTokenMap(nextMap);
}

export function buildLocalizedTranscriptionPath(
  locale: string,
  publicId: string
): string {
  const basePath = `/transcriptions/${publicId}`;
  return locale === "en" ? basePath : `/${locale}${basePath}`;
}

function readUploadPreferencesMap(): UploadPreferencesMap {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(UPLOAD_PREFERENCES_STORAGE_KEY);
    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue) as Record<
      string,
      { aiSummary?: unknown; aiMindMap?: unknown; fileName?: unknown } | null
    >;

    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([publicId, value]) => [
        publicId,
        {
          aiSummary: value?.aiSummary === "general" ? "general" : "off",
          aiMindMap: value?.aiMindMap === "general" ? "general" : "off",
          ...(typeof value?.fileName === "string" && value.fileName.trim()
            ? { fileName: value.fileName.trim() }
            : {}),
        },
      ])
    );
  } catch {
    return {};
  }
}

function writeUploadPreferencesMap(value: UploadPreferencesMap): void {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(
      UPLOAD_PREFERENCES_STORAGE_KEY,
      JSON.stringify(value)
    );
  } catch {
    // Ignore storage failures in private mode and quota edge cases.
  }
}

export function saveTranscriptionUploadPreferences(
  publicId: string,
  preferences: TranscriptionUploadPreferences
): void {
  if (!publicId) {
    return;
  }

  const nextMap = readUploadPreferencesMap();
  nextMap[publicId] = preferences;
  writeUploadPreferencesMap(nextMap);
}

export function getTranscriptionUploadPreferences(
  publicId: string
): TranscriptionUploadPreferences | null {
  return readUploadPreferencesMap()[publicId] ?? null;
}

export function savePendingTranscriptionClaim(
  value: PendingTranscriptionClaim
): void {
  if (!canUseStorage() || !value.publicId || !value.anonymousAccessToken) {
    return;
  }

  try {
    window.localStorage.setItem(PENDING_CLAIM_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Ignore storage failures in private mode and quota edge cases.
  }
}

export function getPendingTranscriptionClaim(): PendingTranscriptionClaim | null {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(PENDING_CLAIM_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as PendingTranscriptionClaim | null;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.publicId !== "string" ||
      typeof parsed.anonymousAccessToken !== "string" ||
      typeof parsed.createdAt !== "number"
    ) {
      window.localStorage.removeItem(PENDING_CLAIM_STORAGE_KEY);
      return null;
    }

    if (Date.now() - parsed.createdAt > ANONYMOUS_TRANSCRIPTION_RETENTION_MS) {
      window.localStorage.removeItem(PENDING_CLAIM_STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    window.localStorage.removeItem(PENDING_CLAIM_STORAGE_KEY);
    return null;
  }
}

export function clearPendingTranscriptionClaim(): void {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(PENDING_CLAIM_STORAGE_KEY);
  } catch {
    // Ignore storage failures in private mode and quota edge cases.
  }
}
