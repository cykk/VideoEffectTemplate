import { and, count, desc, eq, ilike, type SQL } from "drizzle-orm";
import {
    errorResponse,
    successResponse,
    unauthorizedResponse,
    internalErrorResponse,
} from "@markless/shared/src/lib/api/response";
import { db } from "@markless/server/src/lib/db";
import { orders } from "@markless/server/src/lib/db/schema";
import { requireAdminSession } from "@markless/server/src/lib/admin/require-admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const admin = await requireAdminSession(request.headers);
        if (!admin) {
            return unauthorizedResponse("Admin access required");
        }

        const searchParams = new URL(request.url).searchParams;
        const requestedPage = Number.parseInt(
            searchParams.get("page") ?? "1",
            10,
        );
        const requestedPageSize = Number.parseInt(
            searchParams.get("pageSize") ?? "10",
            10,
        );
        const page =
            Number.isInteger(requestedPage) && requestedPage > 0
                ? requestedPage
                : 1;
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
            conditions.push(ilike(orders.customerEmail, `%${email}%`));
        }
        if (status) {
            conditions.push(eq(orders.status, status));
        }
        const where = conditions.length ? and(...conditions) : undefined;
        const [{ total }] = await db
            .select({ total: count(orders.id) })
            .from(orders)
            .where(where);
        const totalCount = Number(total);
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
        const safePage = Math.min(page, totalPages);

        const rows = await db
            .select({
                id: orders.id,
                customerEmail: orders.customerEmail,
                status: orders.status,
                amount: orders.amount,
                currency: orders.currency,
                paymentProvider: orders.paymentProvider,
                createdAt: orders.createdAt,
            })
            .from(orders)
            .where(where)
            .orderBy(desc(orders.createdAt))
            .limit(pageSize)
            .offset((safePage - 1) * pageSize);

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
        console.error("[Admin Orders API] Failed to load orders:", error);
        return internalErrorResponse();
    }
}
