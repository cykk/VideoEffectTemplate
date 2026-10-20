import { count, desc, eq, sql } from "drizzle-orm";
import { successResponse, unauthorizedResponse, internalErrorResponse } from "@markless/shared/src/lib/api/response";
import { db } from "@markless/server/src/lib/db";
import { userCredits, users } from "@markless/server/src/lib/db/schema";
import { requireAdminSession } from "@markless/server/src/lib/admin/require-admin-session";
import { getPrimarySubscriptionsByUserIds } from "@markless/server/src/lib/admin/get-primary-subscriptions-by-user-ids";
import { getAdminSubscriptionPlanLabel } from "@markless/shared/src/lib/subscriptions/admin-plan-label";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export async function GET(request: Request) {
  try {
    const admin = await requireAdminSession(request.headers);
    if (!admin) {
      return unauthorizedResponse("Admin access required");
    }

    const { searchParams } = new URL(request.url);
    const requestedPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
    const requestedPageSize = Number.parseInt(
      searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE),
      10
    );
    const safeRequestedPage = Number.isNaN(requestedPage) || requestedPage < 1 ? 1 : requestedPage;
    const pageSize =
      Number.isNaN(requestedPageSize) || requestedPageSize < 1
        ? DEFAULT_PAGE_SIZE
        : Math.min(requestedPageSize, MAX_PAGE_SIZE);

    const [totalResult] = await db.select({ count: count() }).from(users);
    const totalCount = Number(totalResult?.count ?? 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const currentPage = Math.min(safeRequestedPage, totalPages);
    const offset = (currentPage - 1) * pageSize;

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        totalCredits: sql<number>`coalesce(${userCredits.totalEarned}, 0)`,
        remainingCredits: sql<number>`coalesce(${userCredits.totalBalance}, 0)`,
        spentCredits: sql<number>`coalesce(${userCredits.totalSpent}, 0)`,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(userCredits, eq(userCredits.userId, users.id))
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(pageSize)
      .offset(offset);

    const subscriptionByUserId = await getPrimarySubscriptionsByUserIds(
      rows.map((row) => row.id)
    );

    const rowsWithSubscription = rows.map((row) => {
      const subscription = subscriptionByUserId.get(row.id);
      if (!subscription) {
        return { ...row, subscription: null };
      }
      return {
        ...row,
        subscription: {
          id: subscription.id,
          planLabel: getAdminSubscriptionPlanLabel({
            planId: subscription.planId,
            planName: subscription.planName,
          }),
          status: subscription.status,
          provider: subscription.provider,
          interval: subscription.interval,
          currentPeriodEnd: subscription.currentPeriodEnd,
        },
      };
    });

    return successResponse({
      rows: rowsWithSubscription,
      pagination: {
        totalCount,
        totalPages,
        currentPage,
        pageSize,
        hasPrev: currentPage > 1,
        hasNext: currentPage < totalPages,
      },
    });
  } catch (error) {
    console.error("[Admin Users API] Failed to load users:", error);
    return internalErrorResponse();
  }
}
