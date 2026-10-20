import { inArray } from "drizzle-orm";
import { SUBSCRIPTION_STATUS } from "@markless/shared/src/constants/subscription";
import { db } from "@markless/server/src/lib/db";
import { userSubscriptions } from "@markless/server/src/lib/db/schema";

const STATUS_PRIORITY: Record<string, number> = {
  [SUBSCRIPTION_STATUS.ACTIVE]: 1,
  [SUBSCRIPTION_STATUS.PAST_DUE]: 2,
  [SUBSCRIPTION_STATUS.PAUSED]: 3,
  [SUBSCRIPTION_STATUS.EXPIRED]: 4,
};

export type PrimaryUserSubscriptionRow = {
  id: string;
  userId: string;
  planId: string;
  planName: string;
  status: string;
  provider: string;
  interval: string;
  currentPeriodEnd: Date;
  updatedAt: Date;
};

function comparePrimarySubscription(
  a: PrimaryUserSubscriptionRow,
  b: PrimaryUserSubscriptionRow
): number {
  const priorityA = STATUS_PRIORITY[a.status] ?? 99;
  const priorityB = STATUS_PRIORITY[b.status] ?? 99;
  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }
  return b.updatedAt.getTime() - a.updatedAt.getTime();
}

function pickPrimarySubscription(
  subscriptions: PrimaryUserSubscriptionRow[]
): PrimaryUserSubscriptionRow | null {
  if (subscriptions.length === 0) {
    return null;
  }
  return [...subscriptions].sort(comparePrimarySubscription)[0] ?? null;
}

/**
 * 每个 userId 返回一条「当前展示用」订阅：active → past_due → paused → 最新 updated。
 */
export async function getPrimarySubscriptionsByUserIds(
  userIds: string[]
): Promise<Map<string, PrimaryUserSubscriptionRow>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      id: userSubscriptions.id,
      userId: userSubscriptions.userId,
      planId: userSubscriptions.planId,
      planName: userSubscriptions.planName,
      status: userSubscriptions.status,
      provider: userSubscriptions.provider,
      interval: userSubscriptions.interval,
      currentPeriodEnd: userSubscriptions.currentPeriodEnd,
      updatedAt: userSubscriptions.updatedAt,
    })
    .from(userSubscriptions)
    .where(inArray(userSubscriptions.userId, uniqueIds));

  const byUser = new Map<string, PrimaryUserSubscriptionRow[]>();
  for (const row of rows) {
    const list = byUser.get(row.userId) ?? [];
    list.push({
      ...row,
      currentPeriodEnd: row.currentPeriodEnd,
      updatedAt: row.updatedAt,
    });
    byUser.set(row.userId, list);
  }

  const result = new Map<string, PrimaryUserSubscriptionRow>();
  for (const userId of uniqueIds) {
    const primary = pickPrimarySubscription(byUser.get(userId) ?? []);
    if (primary) {
      result.set(userId, primary);
    }
  }
  return result;
}
