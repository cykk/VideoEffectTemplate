import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { errorResponse, successResponse, unauthorizedResponse } from "@markless/shared/src/lib/api/response";
import { auth } from "@markless/server/src/lib/auth/server";
import { db } from "@markless/server/src/lib/db/client";
import { userCredits } from "@markless/server/src/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user) {
      return unauthorizedResponse();
    }

    const userId = session.user.id;

    // 获取最新积分余额
    const credit = await db.query.userCredits.findFirst({
      where: eq(userCredits.userId, userId),
      columns: {
        totalBalance: true,
        subscriptionCredits: true,
        purchasedCredits: true,
        bonusCredits: true,
      },
    });

    return successResponse({
      credits: credit?.totalBalance ?? 0,
      creditsBreakdown: credit
        ? {
            totalBalance: credit.totalBalance,
            subscriptionCredits: credit.subscriptionCredits,
            purchasedCredits: credit.purchasedCredits,
            bonusCredits: credit.bonusCredits,
          }
        : null,
    });
  } catch (error) {
    console.error("[API] Failed to fetch user credits:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to fetch credits", 500);
  }
}
