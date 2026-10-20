import { NextRequest } from "next/server";
import { auth } from "@markless/server/src/lib/auth/server";
import { db } from "@markless/server/src/lib/db";
import { isRetryableDatabaseConnectionError } from "@markless/server/src/lib/db/client";
import { users } from "@markless/server/src/lib/db/schema/users";
import { userCredits } from "@markless/server/src/lib/db/schema/credits";
import { userSubscriptions } from "@markless/server/src/lib/db/schema/subscriptions";
import {
  getFreeTranscriptionPublicConfig,
  getFreeTranscriptionConfig,
  type FreeTranscriptionPublicConfig,
} from "@markless/shared/src/lib/transcriptions/free-transcription-config";
import { SUBSCRIPTION_STATUS } from "@markless/shared/src/constants/subscription";
import { getFreeTranscriptionUsageAvailability } from "@markless/shared/src/lib/transcriptions/free-usage";
import type { UserEntitlements } from "@markless/shared/src/types/user-entitlements";
import { resolveTranscriptionAccessPolicy } from "@markless/server/src/lib/transcriptions/access-policy";
import { getAnonymousTranscriptionSessionId } from "@markless/shared/src/lib/transcriptions/anonymous-session";
import { and, desc, eq } from "drizzle-orm";

export type UserBootstrapData = {
  authenticated: boolean;
  user: Awaited<ReturnType<typeof auth.api.getSession>>["user"] | null;
  freeTranscription: FreeTranscriptionPublicConfig;
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

const SESSION_RETRY_DELAY_MS = 150;

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function getNextUtcDailyResetIso(now: Date): string {
  const nextUtcMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0
  );

  return new Date(nextUtcMidnight).toISOString();
}

const addMonthsUtc = (date: Date, months: number) => {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
};

const getMonthlyQuota = (creditsPerPeriod: number, interval: string) =>
  interval === "year" ? Math.floor(creditsPerPeriod / 12) : creditsPerPeriod;

const getNextUsagePeriodReset = (
  interval: string,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  now: Date
): Date => {
  if (interval === "month") {
    return currentPeriodEnd;
  }

  let windowStart = new Date(currentPeriodStart);
  while (true) {
    const nextWindow = addMonthsUtc(windowStart, 1);
    if (nextWindow > now) {
      return nextWindow;
    }
    windowStart = nextWindow;
  }
};

async function buildUserEntitlements(input: {
  userId: string;
  anonymousSessionId?: string | null;
  subscriptionCredits: number;
  purchasedCredits: number;
  subscription: {
    planId: string;
    planName: string;
    interval: string;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    creditsPerPeriod: number;
  } | null;
}): Promise<UserEntitlements> {
  const accessPolicy = await resolveTranscriptionAccessPolicy(input.userId);
  const now = new Date();
  const packUsage =
    input.purchasedCredits > 0
      ? { minutesRemaining: Math.max(0, input.purchasedCredits) }
      : null;

  if (accessPolicy.billingMode === "subscription" && input.subscription) {
    const minutesIncluded = getMonthlyQuota(
      input.subscription.creditsPerPeriod,
      input.subscription.interval
    );
    const minutesRemaining = Math.max(0, input.subscriptionCredits);
    const minutesUsed = Math.max(0, minutesIncluded - minutesRemaining);
    const periodReset =
      input.subscription.currentPeriodStart && input.subscription.currentPeriodEnd
        ? getNextUsagePeriodReset(
            input.subscription.interval,
            input.subscription.currentPeriodStart,
            input.subscription.currentPeriodEnd,
            now
          ).toISOString()
        : null;

    return {
      billingMode: "subscription",
      subscriptionUsage: {
        minutesRemaining,
        minutesIncluded,
        minutesUsed,
        periodReset,
        planId: input.subscription.planId,
        planName: input.subscription.planName,
        interval: input.subscription.interval === "year" ? "year" : "month",
      },
      packUsage,
    };
  }

  if (accessPolicy.billingMode === "credits" && packUsage) {
    return {
      billingMode: "credits",
      packUsage,
    };
  }

  const freeConfig =
    accessPolicy.billingMode === "free"
      ? accessPolicy.free
      : getFreeTranscriptionConfig("authenticated");

  const availability = await getFreeTranscriptionUsageAvailability({
    userId: input.userId,
    anonymousSessionId: input.anonymousSessionId,
    dailyLimit: freeConfig.dailyLimit,
    now,
  });

  return {
    billingMode: "free",
    freeDaily: {
      used: availability.used,
      limit: availability.limit,
      remaining: availability.remaining,
      durationLimitMinutes: freeConfig.durationLimitMinutes,
      resetsAt: getNextUtcDailyResetIso(now),
    },
  };
}

async function getSessionWithRetry(requestHeaders: Headers) {
  try {
    return await auth.api.getSession({ headers: requestHeaders });
  } catch (error) {
    if (!isRetryableDatabaseConnectionError(error)) {
      throw error;
    }

    console.warn("[UserBootstrap] Retrying getSession after retryable DB error:", error);
    await sleep(SESSION_RETRY_DELAY_MS);
    return auth.api.getSession({ headers: requestHeaders });
  }
}

export async function getUserBootstrap(
  req: NextRequest
): Promise<UserBootstrapData> {
  const freeTranscription = getFreeTranscriptionPublicConfig();
  const session = await getSessionWithRetry(req.headers);

  if (!session?.user) {
    return {
      authenticated: false,
      user: null,
      freeTranscription,
      credits: 0,
      creditsBreakdown: null,
      subscription: null,
      entitlements: null,
      isAdmin: false,
    };
  }

  const [creditResult, subscriptionResult, userResult] = await Promise.allSettled([
    db.query.userCredits.findFirst({
      where: eq(userCredits.userId, session.user.id),
      columns: {
        totalBalance: true,
        subscriptionCredits: true,
        purchasedCredits: true,
        bonusCredits: true,
      },
    }),
    db.query.userSubscriptions.findFirst({
      where: and(
        eq(userSubscriptions.userId, session.user.id),
        eq(userSubscriptions.status, SUBSCRIPTION_STATUS.ACTIVE)
      ),
      orderBy: [desc(userSubscriptions.currentPeriodEnd)],
      columns: {
        planId: true,
        planName: true,
        status: true,
        interval: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        creditsPerPeriod: true,
      },
    }),
    db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: {
        role: true,
      },
    }),
  ]);

  if (creditResult.status === "rejected") {
    console.error("[UserBootstrap] Failed to load user credits:", {
      userId: session.user.id,
      error: creditResult.reason,
    });
  }

  if (subscriptionResult.status === "rejected") {
    console.error("[UserBootstrap] Failed to load user subscription:", {
      userId: session.user.id,
      error: subscriptionResult.reason,
    });
  }

  if (userResult.status === "rejected") {
    console.error("[UserBootstrap] Failed to load user role:", {
      userId: session.user.id,
      error: userResult.reason,
    });
  }

  const credit = creditResult.status === "fulfilled" ? creditResult.value : null;
  const subscription =
    subscriptionResult.status === "fulfilled" ? subscriptionResult.value : null;
  const user = userResult.status === "fulfilled" ? userResult.value : null;
  const entitlements = await buildUserEntitlements({
    userId: session.user.id,
    anonymousSessionId: getAnonymousTranscriptionSessionId(req),
    subscriptionCredits: credit?.subscriptionCredits ?? 0,
    purchasedCredits: credit?.purchasedCredits ?? 0,
    subscription: subscription
      ? {
          planId: subscription.planId,
          planName: subscription.planName,
          interval: subscription.interval,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          creditsPerPeriod: subscription.creditsPerPeriod,
        }
      : null,
  });

  return {
    authenticated: true,
    user: session.user,
    freeTranscription,
    credits: credit?.totalBalance ?? 0,
    creditsBreakdown: credit
      ? {
          totalBalance: credit.totalBalance,
          subscriptionCredits: credit.subscriptionCredits,
          purchasedCredits: credit.purchasedCredits,
          bonusCredits: credit.bonusCredits,
        }
      : null,
    subscription: subscription
      ? {
          planId: subscription.planId,
          planName: subscription.planName,
          status: subscription.status,
          interval: subscription.interval,
          currentPeriodEnd: subscription.currentPeriodEnd,
          creditsPerPeriod: subscription.creditsPerPeriod,
        }
      : null,
    entitlements,
    isAdmin: user?.role === "admin",
  };
}
