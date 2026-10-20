import { addMonths, addYears, format } from "date-fns";
import { count, desc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { errorResponse, successResponse, unauthorizedResponse } from "@markless/shared/src/lib/api/response";
import { auth } from "@markless/server/src/lib/auth/server";
import { db } from "@markless/server/src/lib/db";
import { orders } from "@markless/server/src/lib/db/schema/orders";
import { waffoLedger } from "@markless/server/src/lib/payments/providers/waffo/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ITEMS_PER_PAGE = 10;

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(req.url);
    const locale = (searchParams.get("locale") || "en").trim();
    const page = Math.max(Number(searchParams.get("page") || "1") || 1, 1);
    const offset = (page - 1) * ITEMS_PER_PAGE;

    const [totalResult] = await db
      .select({ count: count() })
      .from(orders)
      .where(eq(orders.userId, session.user.id));

    const totalCount = totalResult?.count || 0;
    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

    const userOrders = await db.query.orders.findMany({
      where: eq(orders.userId, session.user.id),
      orderBy: [desc(orders.createdAt)],
      limit: ITEMS_PER_PAGE,
      offset,
    });

    const ledger = await waffoLedger(userOrders.filter(order => order.paymentProvider === 'waffo').map(order => order.id));
    const data = userOrders.map((order) => {
      const receipt = ledger.get(order.id);
      const date = new Date(order.paidAt || order.createdAt);
      let period: string | null = null;

      if (order.productType === "subscription" && order.status === "paid") {
        const metadata = order.metadata as Record<string, unknown> | null;
        const interval =
          (metadata?.subscription_interval as string) ||
          (order.productName.toLowerCase().includes("year") ? "year" : "month");
        const endDate = interval === "year" ? addYears(date, 1) : addMonths(date, 1);
        period = `${format(date, "MMM dd")} - ${format(endDate, "MMM dd, yyyy")}`;
      }

      let paymentMethod = "Online Payment";
      if (order.paymentProvider === "creem") {
        paymentMethod = "Credit Card";
      } else if (order.paymentProvider === "waffo") {
        paymentMethod = "Waffo";
      }

      let statusColor =
        "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400";
      let statusLabel = order.status;

      if (order.status === "paid") {
        statusColor =
          "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 ring-1 ring-inset ring-green-600/20";
        statusLabel = locale === "en" ? "Paid" : "支払い済み";
      } else if (order.status === "failed") {
        statusColor =
          "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 ring-1 ring-inset ring-red-600/20";
        statusLabel = locale === "en" ? "Failed" : "失敗";
      } else if (order.status === "refunded") {
        statusColor =
          "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 ring-1 ring-inset ring-yellow-600/20";
        statusLabel = locale === "en" ? "Refunded" : "返金済み";
      }

      return {
        id: order.id,
        orderNumber: order.orderNumber || order.id,
        date: format(date, "yyyy-MM-dd"),
        product: order.productName,
        period,
        amount: `${receipt?.receipts.length ? receipt.charged : order.amount} ${order.currency.toUpperCase()}`,
        receipts: receipt?.receipts,
        status: order.status,
        statusLabel,
        statusColor,
        paymentMethod,
      };
    });

    return successResponse({
      data,
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        hasPrev: page > 1,
        hasNext: page < totalPages,
      },
    });
  } catch (error) {
    console.error("[API] Failed to fetch order history:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to fetch order history", 500);
  }
}
