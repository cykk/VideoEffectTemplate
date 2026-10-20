import { getEnv } from "@markless/shared/src/lib/config/env";

export function normalizeR2Domain(value?: string): string {
  return (value || "").replace(/^https?:\/*\/?/, "").replace(/\/$/, "");
}

export function buildR2PublicUrl(domain: string, key: string): string {
  const normalized = normalizeR2Domain(domain);
  return normalized ? `https://${normalized}/${key}` : "";
}

export function extractAccountIdFromEndpoint(endpoint?: string): string | undefined {
  if (!endpoint) return undefined;

  try {
    const url = new URL(endpoint);
    const accountId = url.hostname.split(".")[0];
    return accountId || undefined;
  } catch {
    return undefined;
  }
}

export function resolveR2AccountId(): string | undefined {
  return getEnv("R2_ACCOUNT_ID") || extractAccountIdFromEndpoint(getEnv("R2_ENDPOINT"));
}

export function resolveR2Endpoint(): string {
  const endpoint = getEnv("R2_ENDPOINT");
  if (endpoint) {
    return endpoint;
  }
  const accountId = resolveR2AccountId();
  return accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "";
}
