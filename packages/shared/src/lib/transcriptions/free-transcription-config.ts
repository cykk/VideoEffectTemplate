import { getEnv } from "@markless/shared/src/lib/config/env";
import {
  DEFAULT_ANONYMOUS_FREE_TRANSCRIPTION_DAILY_LIMIT,
  DEFAULT_AUTHENTICATED_FREE_TRANSCRIPTION_DAILY_LIMIT,
} from "@markless/shared/src/lib/transcriptions/free-usage-constants";

export const DEFAULT_FREE_TRANSCRIPTION_DURATION_LIMIT_MINUTES = 30;
export const DEFAULT_AUTHENTICATED_FREE_TRANSCRIPTION_DURATION_LIMIT_MINUTES = 30;

export type FreeTranscriptionAccessMode = "anonymous" | "authenticated";
export type FreeTranscriptionConfig = {
  dailyLimit: number;
  durationLimitMinutes: number;
};

export type FreeTranscriptionPublicConfig = {
  anonymous: FreeTranscriptionConfig;
  authenticated: FreeTranscriptionConfig;
};

function getPositiveInteger(environmentKey: string, fallback: number): number {
  const rawValue = getEnv(environmentKey);
  const parsedMinutes = Number.parseInt(rawValue ?? "", 10);
  if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
    return fallback;
  }
  return parsedMinutes;
}

export function getFreeTranscriptionConfig(
  accessMode: FreeTranscriptionAccessMode
): FreeTranscriptionConfig {
  if (accessMode === "authenticated") {
    return {
      dailyLimit: getPositiveInteger(
        "AUTHENTICATED_FREE_TRANSCRIPTION_DAILY_LIMIT",
        DEFAULT_AUTHENTICATED_FREE_TRANSCRIPTION_DAILY_LIMIT
      ),
      durationLimitMinutes: getPositiveInteger(
        "AUTHENTICATED_FREE_TRANSCRIPTION_DURATION_LIMIT_MINUTES",
        DEFAULT_AUTHENTICATED_FREE_TRANSCRIPTION_DURATION_LIMIT_MINUTES
      ),
    };
  }

  return {
    dailyLimit: getPositiveInteger(
      "GUEST_FREE_TRANSCRIPTION_DAILY_LIMIT",
      DEFAULT_ANONYMOUS_FREE_TRANSCRIPTION_DAILY_LIMIT
    ),
    durationLimitMinutes: getPositiveInteger(
      "GUEST_FREE_TRANSCRIPTION_DURATION_LIMIT_MINUTES",
      getPositiveInteger(
        "FREE_TRANSCRIPTION_DURATION_LIMIT_MINUTES",
        DEFAULT_FREE_TRANSCRIPTION_DURATION_LIMIT_MINUTES
      )
    ),
  };
}

export function getFreeTranscriptionDurationLimitMinutes(
  accessMode: FreeTranscriptionAccessMode = "anonymous"
): number {
  return getFreeTranscriptionConfig(accessMode).durationLimitMinutes;
}

export function getFreeTranscriptionDurationLimitMs(
  accessMode: FreeTranscriptionAccessMode = "anonymous"
): number {
  return getFreeTranscriptionDurationLimitMinutes(accessMode) * 60 * 1000;
}

export function getFreeTranscriptionPublicConfig(): FreeTranscriptionPublicConfig {
  return {
    anonymous: getFreeTranscriptionConfig("anonymous"),
    authenticated: getFreeTranscriptionConfig("authenticated"),
  };
}
