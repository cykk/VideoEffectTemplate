import {
  getFreeTranscriptionConfig,
} from "@markless/shared/src/lib/transcriptions/free-transcription-config";

export type FreeTierCopyValues = {
  guestDailyLimit: number;
  guestDurationLimitMinutes: number;
  authenticatedDailyLimit: number;
  authenticatedDurationLimitMinutes: number;
};

export function getFreeTierCopyValues(): FreeTierCopyValues {
  const anonymous = getFreeTranscriptionConfig("anonymous");
  const authenticated = getFreeTranscriptionConfig("authenticated");
  return {
    guestDailyLimit: anonymous.dailyLimit,
    guestDurationLimitMinutes: anonymous.durationLimitMinutes,
    authenticatedDailyLimit: authenticated.dailyLimit,
    authenticatedDurationLimitMinutes: authenticated.durationLimitMinutes,
  };
}

export function formatFreeTierCopy(
  template: string,
  overrides?: Partial<FreeTierCopyValues>
): string {
  const defaults = getFreeTierCopyValues();
  const values = { ...defaults, ...overrides };

  return template
    .replace(/\{guestDailyLimit\}/g, String(values.guestDailyLimit))
    .replace(/\{guestDurationLimitMinutes\}/g, String(values.guestDurationLimitMinutes))
    .replace(/\{authenticatedDailyLimit\}/g, String(values.authenticatedDailyLimit))
    .replace(/\{authenticatedDurationLimitMinutes\}/g, String(values.authenticatedDurationLimitMinutes));
}
