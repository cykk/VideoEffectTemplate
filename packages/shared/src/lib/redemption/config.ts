import { getEnv } from "@markless/shared/src/lib/config/env";

export const APPSUMO_PROVIDER = "appsumo";
export const APPSUMO_TIER_ID = "appsumo_tier1";
export const DEFAULT_APPSUMO_CREDITS = 3000;
export const DEFAULT_APPSUMO_MAX_CODES_PER_USER = 1;
export const DEFAULT_APPSUMO_BATCH_ID = "appsumo-2026-03";
export const REDEMPTION_CODE_PATTERN = /^AS-TRNV-[A-Z0-9]{5}-[A-Z0-9]{5}$/;

const DISABLED_VALUES = new Set(["0", "false", "off", "no"]);

export function isAppsumoRedemptionEnabled(): boolean {
  const rawValue = getEnv("APPSUMO_REDEMPTION_ENABLED");
  if (!rawValue) {
    return true;
  }

  return !DISABLED_VALUES.has(rawValue.toLowerCase());
}

export function getAppsumoCreditsAmount(): number {
  const rawValue = getEnv("APPSUMO_TIER1_CREDITS");
  const parsedAmount = Number.parseInt(rawValue ?? "", 10);

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return DEFAULT_APPSUMO_CREDITS;
  }

  return parsedAmount;
}

export function getAppsumoMaxCodesPerUser(): number {
  const rawValue = getEnv("APPSUMO_MAX_CODES_PER_USER");
  const parsedMax = Number.parseInt(rawValue ?? "", 10);

  if (!Number.isFinite(parsedMax) || parsedMax <= 0) {
    return DEFAULT_APPSUMO_MAX_CODES_PER_USER;
  }

  return parsedMax;
}

export function getAppsumoBatchId(): string {
  return getEnv("APPSUMO_BATCH_ID")?.trim() || DEFAULT_APPSUMO_BATCH_ID;
}

export function normalizeRedemptionCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidRedemptionCodeFormat(code: string): boolean {
  return REDEMPTION_CODE_PATTERN.test(code);
}
