import { count, desc, eq } from "drizzle-orm";
import type { AdminUserCreditsDetailResponse } from "@markless/shared/src/lib/credits/admin-user-credits";
import { ADMIN_USER_CREDITS_DEFAULT_PAGE_SIZE } from "@markless/shared/src/lib/credits/admin-user-credits";
import { db } from "@markless/server/src/lib/db";
import { creditTransactions, userCredits, users } from "@markless/server/src/lib/db/schema";

function extractReferencePublicId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }
  const publicId = (metadata as { publicId?: unknown }).publicId;
  if (typeof publicId !== "string") {
    return null;
  }
  const trimmed = publicId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function getAdminUserCreditsDetail(input: {
  userId: string;
  page: number;
  pageSize: number;
}): Promise<AdminUserCreditsDetailResponse | null> {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (!user) {
    return null;
  }

  const [creditsRow] = await db
    .select({
      subscriptionCredits: userCredits.subscriptionCredits,
      purchasedCredits: userCredits.purchasedCredits,
      bonusCredits: userCredits.bonusCredits,
      totalBalance: userCredits.totalBalance,
      totalEarned: userCredits.totalEarned,
      totalSpent: userCredits.totalSpent,
    })
    .from(userCredits)
    .where(eq(userCredits.userId, input.userId))
    .limit(1);

  const [{ total }] = await db
    .select({ total: count() })
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, input.userId));

  const totalCount = Number(total ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / input.pageSize));
  const currentPage = Math.min(Math.max(1, input.page), totalPages);
  const offset = (currentPage - 1) * input.pageSize;

  const transactionRows = await db
    .select({
      id: creditTransactions.id,
      type: creditTransactions.type,
      amount: creditTransactions.amount,
      balanceAfter: creditTransactions.balanceAfter,
      description: creditTransactions.description,
      source: creditTransactions.source,
      orderId: creditTransactions.orderId,
      subscriptionId: creditTransactions.subscriptionId,
      metadata: creditTransactions.metadata,
      createdAt: creditTransactions.createdAt,
    })
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, input.userId))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(input.pageSize)
    .offset(offset);

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    balance: {
      total: creditsRow?.totalBalance ?? 0,
      subscription: creditsRow?.subscriptionCredits ?? 0,
      purchased: creditsRow?.purchasedCredits ?? 0,
      bonus: creditsRow?.bonusCredits ?? 0,
      totalEarned: creditsRow?.totalEarned ?? 0,
      totalSpent: creditsRow?.totalSpent ?? 0,
    },
    transactions: transactionRows.map((row) => ({
      id: row.id,
      type: row.type,
      amount: row.amount,
      balanceAfter: row.balanceAfter,
      description: row.description,
      source: row.source,
      orderId: row.orderId,
      subscriptionId: row.subscriptionId,
      referencePublicId: extractReferencePublicId(row.metadata),
      createdAt: row.createdAt.toISOString(),
    })),
    pagination: {
      totalCount,
      totalPages,
      currentPage,
      pageSize: input.pageSize,
      hasPrev: currentPage > 1,
      hasNext: currentPage < totalPages,
    },
  };
}

export function resolveAdminUserCreditsPageSize(value: number): number {
  if (Number.isNaN(value) || value < 1) {
    return ADMIN_USER_CREDITS_DEFAULT_PAGE_SIZE;
  }
  return Math.min(value, 100);
}
