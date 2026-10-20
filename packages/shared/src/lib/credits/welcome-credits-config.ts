import { getEnv } from "@markless/shared/src/lib/config/env";

export const DEFAULT_WELCOME_CREDITS_AMOUNT = 60;
const DISABLED_VALUES = new Set(["0", "false", "off", "no"]);

export type WelcomeCreditsPublicConfig = {
  enabled: boolean;
  amount: number;
};

export function isWelcomeCreditsEnabled(): boolean {
  const rawValue = getEnv("WELCOME_CREDITS_ENABLED");
  if (!rawValue) {
    return true;
  }

  return !DISABLED_VALUES.has(rawValue.toLowerCase());
}

export function getWelcomeCreditsAmount(): number {
  const rawValue = getEnv("WELCOME_CREDITS_AMOUNT");
  const parsedAmount = Number.parseInt(rawValue ?? "", 10);

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return DEFAULT_WELCOME_CREDITS_AMOUNT;
  }

  return parsedAmount;
}

export function getWelcomeCreditsPublicConfig(): WelcomeCreditsPublicConfig {
  return {
    enabled: isWelcomeCreditsEnabled(),
    amount: getWelcomeCreditsAmount(),
  };
}

