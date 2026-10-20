import { db } from "@markless/server/src/lib/db";
import { userCredits } from "@markless/server/src/lib/db/schema/credits";
import { userSubscriptions } from "@markless/server/src/lib/db/schema/subscriptions";
import { SUBSCRIPTION_STATUS } from "@markless/shared/src/constants/subscription";
import {
  getFreeTranscriptionConfig,
  type FreeTranscriptionAccessMode,
  type FreeTranscriptionConfig,
} from "@markless/shared/src/lib/transcriptions/free-transcription-config";
import { and, eq } from "drizzle-orm";

export type TranscriptionAccessPolicy =
  | { billingMode: "free"; accessMode: FreeTranscriptionAccessMode; free: FreeTranscriptionConfig }
  | { billingMode: "credits" }
  | { billingMode: "subscription" };

export function usesPaidMinutesBilling(
  policy: TranscriptionAccessPolicy
): policy is Extract<TranscriptionAccessPolicy, { billingMode: "credits" | "subscription" }> {
  return policy.billingMode === "credits" || policy.billingMode === "subscription";
}

/** Resolves billing entirely on the server; client-supplied account state is never trusted. */
export async function resolveTranscriptionAccessPolicy(
  userId: string | null
): Promise<TranscriptionAccessPolicy> {
  if (!userId) {
    return {
      billingMode: "free",
      accessMode: "anonymous",
      free: getFreeTranscriptionConfig("anonymous"),
    };
  }

  const subscription = await db.query.userSubscriptions.findFirst({
    where: and(
      eq(userSubscriptions.userId, userId),
      eq(userSubscriptions.status, SUBSCRIPTION_STATUS.ACTIVE)
    ),
    columns: { id: true },
  });

  if (subscription) {
    return { billingMode: "subscription" };
  }

  const creditAccount = await db.query.userCredits.findFirst({
    where: eq(userCredits.userId, userId),
    columns: { purchasedCredits: true },
  });

  if ((creditAccount?.purchasedCredits ?? 0) > 0) {
    return { billingMode: "credits" };
  }

  return {
    billingMode: "free",
    accessMode: "authenticated",
    free: getFreeTranscriptionConfig("authenticated"),
  };
}
