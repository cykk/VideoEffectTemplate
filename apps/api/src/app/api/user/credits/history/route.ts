import { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { errorResponse, successResponse, unauthorizedResponse } from "@markless/shared/src/lib/api/response";
import { auth } from "@markless/server/src/lib/auth/server";
import { db } from "@markless/server/src/lib/db";
import { creditTransactions, userCredits } from "@markless/server/src/lib/db/schema/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return unauthorizedResponse();
    }

    const [credits, history] = await Promise.all([
      db.query.userCredits.findFirst({
        where: eq(userCredits.userId, session.user.id),
      }),
      db.query.creditTransactions.findMany({
        where: eq(creditTransactions.userId, session.user.id),
        orderBy: [desc(creditTransactions.createdAt)],
        limit: 10,
      }),
    ]);

    return successResponse({
      balance: {
        total: credits?.totalBalance || 0,
        plan: credits?.subscriptionCredits || 0,
        pack: credits?.purchasedCredits || 0,
        bonus: credits?.bonusCredits || 0,
      },
      history: history.map((item) => ({
        id: item.id,
        type: item.type,
        amount: item.amount,
        date: new Date(item.createdAt).toISOString(),
        description: item.description || item.type,
      })),
    });
  } catch (error) {
    console.error("[API] Failed to fetch credit history:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to fetch credit history", 500);
  }
}
