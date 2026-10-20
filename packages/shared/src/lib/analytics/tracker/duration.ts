export function resolveDurationBucket(durationMs: number) {
  if (durationMs < 5000) {
    return "<5s";
  }

  if (durationMs < 15000) {
    return "5-15s";
  }

  if (durationMs < 30000) {
    return "15-30s";
  }

  if (durationMs < 60000) {
    return "30-60s";
  }

  return "60s+";
}
