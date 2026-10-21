import { getEnv } from "@markless/shared/src/lib/config/env";

const prefix = getEnv("REDIS_KEY_PREFIX", "saas_starter") ?? "saas_starter";

if (!/^[a-z0-9_-]+$/.test(prefix)) {
  throw new Error("Invalid REDIS_KEY_PREFIX");
}

export const REDIS_KEY_PREFIX = prefix;

export function buildRedisNamespace(...parts: string[]): string {
  return [REDIS_KEY_PREFIX, ...parts].join(":");
}

export const buildRedisKey = buildRedisNamespace;
export const buildRedisChannel = buildRedisNamespace;
export const buildRedisPattern = buildRedisNamespace;
