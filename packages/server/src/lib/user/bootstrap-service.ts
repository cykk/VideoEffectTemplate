import { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@markless/server/src/lib/auth/server";
import { db } from "@markless/server/src/lib/db";
import { isRetryableDatabaseConnectionError } from "@markless/server/src/lib/db/client";
import { users } from "@markless/server/src/lib/db/schema/users";
import { userCredits } from "@markless/server/src/lib/db/schema/credits";
import { userSubscriptions } from "@markless/server/src/lib/db/schema/subscriptions";
import { SUBSCRIPTION_STATUS } from "@markless/shared/src/constants/subscription";
import type { UserEntitlements } from "@markless/shared/src/types/user-entitlements";

export type UserBootstrapData = {
  authenticated: boolean;
  user: Awaited<ReturnType<typeof auth.api.getSession>>["user"] | null;
  credits: number;
  creditsBreakdown: {
    totalBalance: number;
    subscriptionCredits: number;
    purchasedCredits: number;
    bonusCredits: number;
  } | null;
  subscription: {
    planId: string;
    planName: string;
    status: string;
    interval: string;
    currentPeriodEnd: Date | null;
    creditsPerPeriod: number;
  } | null;
  entitlements: UserEntitlements | null;
  isAdmin: boolean;
};

async function getSessionWithRetry(headers: Headers) {
  try {
    return await auth.api.getSession({ headers });
  } catch (error) {
    if (!isRetryableDatabaseConnectionError(error)) throw error;
    await new Promise(resolve => setTimeout(resolve, 150));
    return auth.api.getSession({ headers });
  }
}

export async function getUserBootstrap(req: NextRequest): Promise<UserBootstrapData> {
  const session = await getSessionWithRetry(req.headers);
  if (!session?.user) {
    return { authenticated: false, user: null, credits: 0, creditsBreakdown: null,
      subscription: null, entitlements: null, isAdmin: false };
  }

  const userId = session.user.id;
  const [creditResult, subscriptionResult, userResult] = await Promise.allSettled([
    db.query.userCredits.findFirst({ where: eq(userCredits.userId, userId),
      columns: { totalBalance: true, subscriptionCredits: true, purchasedCredits: true, bonusCredits: true } }),
    db.query.userSubscriptions.findFirst({ where: and(eq(userSubscriptions.userId, userId),
      eq(userSubscriptions.status, SUBSCRIPTION_STATUS.ACTIVE)),
      orderBy: [desc(userSubscriptions.currentPeriodEnd)],
      columns: { planId: true, planName: true, status: true, interval: true,
        currentPeriodEnd: true, creditsPerPeriod: true } }),
    db.query.users.findFirst({ where: eq(users.id, userId), columns: { role: true } }),
  ]);

  if (creditResult.status === "rejected") console.error("[UserBootstrap] Credits unavailable", { userId, error: creditResult.reason });
  if (subscriptionResult.status === "rejected") console.error("[UserBootstrap] Subscription unavailable", { userId, error: subscriptionResult.reason });
  if (userResult.status === "rejected") console.error("[UserBootstrap] Role unavailable", { userId, error: userResult.reason });

  const credit = creditResult.status === "fulfilled" ? creditResult.value : null;
  const subscription = subscriptionResult.status === "fulfilled" ? subscriptionResult.value : null;
  const user = userResult.status === "fulfilled" ? userResult.value : null;
  const balance = credit?.totalBalance ?? 0;

  return {
    authenticated: true,
    user: session.user,
    credits: balance,
    creditsBreakdown: credit ? {
      totalBalance: balance,
      subscriptionCredits: credit.subscriptionCredits,
      purchasedCredits: credit.purchasedCredits,
      bonusCredits: credit.bonusCredits,
    } : null,
    subscription: subscription ? {
      planId: subscription.planId,
      planName: subscription.planName,
      status: subscription.status,
      interval: subscription.interval,
      currentPeriodEnd: subscription.currentPeriodEnd,
      creditsPerPeriod: subscription.creditsPerPeriod,
    } : null,
    entitlements: {
      totalBalance: balance,
      subscriptionCredits: credit?.subscriptionCredits ?? 0,
      purchasedCredits: credit?.purchasedCredits ?? 0,
      bonusCredits: credit?.bonusCredits ?? 0,
      subscription: subscription ? {
        planId: subscription.planId,
        planName: subscription.planName,
        creditsPerPeriod: subscription.creditsPerPeriod,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      } : null,
    },
    isAdmin: user?.role === "admin",
  };
}
