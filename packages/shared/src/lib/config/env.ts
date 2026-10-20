export function getEnv(name: string, fallback?: string): string | undefined {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

export function requireEnv(name: string): string {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function getPublicEnv(name: string, fallback?: string): string | undefined {
  if (!name.startsWith("NEXT_PUBLIC_")) {
    throw new Error(`Public env must start with NEXT_PUBLIC_: ${name}`);
  }
  return getEnv(name, fallback);
}

export function isAnonymousTranscriptionCleanupEnabled(): boolean {
  return getEnv("ENABLE_ANONYMOUS_TRANSCRIPTION_CLEANUP") === "true";
}

export function isTranscriptionFailureArchiveCleanupEnabled(): boolean {
  return getEnv("ENABLE_TRANSCRIPTION_FAILURE_ARCHIVE_CLEANUP") === "true";
}
