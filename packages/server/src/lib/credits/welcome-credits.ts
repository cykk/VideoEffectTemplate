import { CreditService } from "@markless/server/src/lib/credits/service";
import {
  getWelcomeCreditsAmount,
  isWelcomeCreditsEnabled,
} from "@markless/shared/src/lib/credits/welcome-credits-config";

export async function grantWelcomeCredits(userId: string) {
  if (!userId || !isWelcomeCreditsEnabled()) {
    return null;
  }

  const amount = getWelcomeCreditsAmount();

  return CreditService.grantCredits({
    userId,
    amount,
    source: "bonus",
    type: "bonus",
    description: `Welcome bonus credits (${amount})`,
    metadata: {
      reason: "signup_welcome",
      category: "welcome_bonus",
      amount,
    },
    idempotencyKey: `welcome-credits:${userId}:v1`,
  });
}
