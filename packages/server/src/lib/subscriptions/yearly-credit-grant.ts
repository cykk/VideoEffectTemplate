import { and, eq, ne } from "drizzle-orm";
import { db } from "@markless/server/src/lib/db/client";
import { CreditService } from "@markless/server/src/lib/credits/service";
import { userSubscriptions } from "@markless/server/src/lib/db/schema/subscriptions";
import { buildSubscriptionGrantKey } from "@markless/shared/src/lib/credits/idempotency";

const addMonthsUtc = (date: Date, months: number) => {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
};

const getYearlyMonthlyQuota = (creditsPerPeriod: number) =>
  Math.floor(creditsPerPeriod / 12);

const getElapsedMonthlyWindows = (periodStart: Date, now: Date) => {
  let count = 0;

  while (count < 12) {
    const nextWindowStart = addMonthsUtc(periodStart, count + 1);
    if (nextWindowStart <= now) {
      count += 1;
      continue;
    }
    break;
  }

  return count;
};

export type YearlyGrantRunResult = {
  scanned: number;
  granted: number;
  skipped: number;
};

export async function processYearlySubscriptionCreditGrants(
  now = new Date()
): Promise<YearlyGrantRunResult> {
  const subscriptions = await db
    .select()
    .from(userSubscriptions)
    .where(
      and(
        eq(userSubscriptions.status, "active"),
        eq(userSubscriptions.interval, "year"),
        ne(userSubscriptions.provider, "waffo")
      )
    );

  let granted = 0;
  let skipped = 0;

  for (const subscription of subscriptions) {
    const monthlyQuota = getYearlyMonthlyQuota(subscription.creditsPerPeriod);
    if (monthlyQuota <= 0) {
      skipped += 1;
      continue;
    }

    const elapsedWindows = getElapsedMonthlyWindows(
      subscription.currentPeriodStart,
      now
    );
    const alreadyGranted = Math.max(0, subscription.creditGrantCount || 0);
    const targetWindows = Math.min(12, elapsedWindows + 1);

    if (alreadyGranted >= targetWindows) {
      skipped += 1;
      continue;
    }

    let appliedGrantForSubscription = false;

    for (let grantIndex = alreadyGranted; grantIndex < targetWindows; grantIndex += 1) {
      const windowStart = addMonthsUtc(subscription.currentPeriodStart, grantIndex);
      const idempotencyKey = buildSubscriptionGrantKey(subscription.id, windowStart);
      const existingGrant =
        await CreditService.getTransactionByIdempotencyKey(idempotencyKey);

      if (existingGrant) {
        await db
          .update(userSubscriptions)
          .set({
            lastCreditGrantAt: windowStart,
            creditGrantCount: grantIndex + 1,
            updatedAt: new Date(),
          })
          .where(eq(userSubscriptions.id, subscription.id));
        continue;
      }

      await db.transaction(async (tx) => {
        await CreditService.expireSubscriptionCredits(subscription.userId, tx);

        await CreditService.grantCredits({
          userId: subscription.userId,
          amount: monthlyQuota,
          source: "subscription",
          type: "subscription_grant",
          subscriptionId: subscription.id,
          description: "SUBSCRIPTION_YEARLY_MONTHLY_DRIP",
          metadata: {
            provider: subscription.provider,
            subscription_id: subscription.id,
            plan_id: subscription.planId,
            interval: subscription.interval,
            grant_mode: "yearly_monthly_drip",
            grant_sequence: grantIndex + 1,
            grant_window_start: windowStart.toISOString(),
            grant_window_end: addMonthsUtc(windowStart, 1).toISOString(),
            monthly_quota: monthlyQuota,
          },
          idempotencyKey,
          tx,
        });

        await tx
          .update(userSubscriptions)
          .set({
            lastCreditGrantAt: windowStart,
            creditGrantCount: grantIndex + 1,
            updatedAt: new Date(),
          })
          .where(eq(userSubscriptions.id, subscription.id));
      });

      appliedGrantForSubscription = true;
      granted += 1;
    }

    if (!appliedGrantForSubscription) {
      skipped += 1;
    }
  }

  return {
    scanned: subscriptions.length,
    granted,
    skipped,
  };
}
