/** 匿名转录数据、access token、pendingClaim 的统一保留时长。 */
export const ANONYMOUS_TRANSCRIPTION_RETENTION_MS = 24 * 60 * 60 * 1000;

export const ANONYMOUS_TRANSCRIPTION_RETENTION_SECONDS = Math.floor(
  ANONYMOUS_TRANSCRIPTION_RETENTION_MS / 1000
);
