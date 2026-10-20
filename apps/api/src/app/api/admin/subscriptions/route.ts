import { and, count, desc, eq, ilike, type SQL } from "drizzle-orm";
import {
  successResponse,
  unauthorizedResponse,
  internalErrorResponse,
} from "@markless/shared/src/lib/api/response";
import { db } from "@markless/server/src/lib/db";
import { userSubscriptions, users } from "@markless/server/src/lib/db/schema";
import { requireAdminSession } from "@markless/server/src/lib/admin/require-admin-session";
import { getAdminSubscriptionPlanLabel } from "@markless/shared/src/lib/subscriptions/admin-plan-label";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const admin = await requireAdminSession(request.headers);
    if (!admin) {
      return unauthorizedResponse("Admin access required");
    }

    const searchParams = new URL(request.url).searchParams;
    const requestedPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
    const requestedPageSize = Number.parseInt(
      searchParams.get("pageSize") ?? "10",
      10,
    );
    const page =
      Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const allowedPageSizes = [10, 20, 30, 50] as const;
    const pageSize = allowedPageSizes.includes(
      requestedPageSize as (typeof allowedPageSizes)[number],
    )
      ? requestedPageSize
      : 10;
    const email = searchParams.get("email")?.trim() ?? "";
    const status = searchParams.get("status")?.trim() ?? "";

    const conditions: SQL[] = [];
    if (email) {
      conditions.push(ilike(users.email, `%${email}%`));
    }
    if (status) {
      conditions.push(eq(userSubscriptions.status, status));
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count(userSubscriptions.id) })
      .from(userSubscriptions)
      .leftJoin(users, eq(userSubscriptions.userId, users.id))
      .where(where);
    const totalCount = Number(total);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const safePage = Math.min(page, totalPages);

    const rawRows = await db
      .select({
        id: userSubscriptions.id,
        userEmail: users.email,
        planId: userSubscriptions.planId,
        planName: userSubscriptions.planName,
        status: userSubscriptions.status,
        provider: userSubscriptions.provider,
        interval: userSubscriptions.interval,
        currentPeriodEnd: userSubscriptions.currentPeriodEnd,
        createdAt: userSubscriptions.createdAt,
      })
      .from(userSubscriptions)
      .leftJoin(users, eq(userSubscriptions.userId, users.id))
      .where(where)
      .orderBy(desc(userSubscriptions.createdAt))
      .limit(pageSize)
      .offset((safePage - 1) * pageSize);

    const rows = rawRows.map((row) => ({
      id: row.id,
      userEmail: row.userEmail,
      planLabel: getAdminSubscriptionPlanLabel({
        planId: row.planId,
        planName: row.planName,
      }),
      status: row.status,
      provider: row.provider,
      interval: row.interval,
      currentPeriodEnd: row.currentPeriodEnd,
      createdAt: row.createdAt,
    }));

    return successResponse({
      rows,
      pagination: {
        page: safePage,
        pageSize,
        total: totalCount,
        totalPages,
      },
    });
  } catch (error) {
    console.error("[Admin Subscriptions API] Failed to load subscriptions:", error);
    return internalErrorResponse();
  }
}
