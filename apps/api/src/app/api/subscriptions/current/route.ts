import { NextRequest } from "next/server";
import { errorResponse, successResponse, unauthorizedResponse } from "@markless/shared/src/lib/api/response";
import { getUserSubscriptionData } from "@markless/server/src/lib/subscriptions/data/fetch";
import { getUserBootstrap } from "@markless/server/src/lib/user/bootstrap-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const bootstrap = await getUserBootstrap(req);

    if (!bootstrap.authenticated || !bootstrap.user) {
      return unauthorizedResponse();
    }

    const subscription = await getUserSubscriptionData(bootstrap.user.id);

    return successResponse({
      subscription: subscription
        ? {
            creditsPerPeriod: subscription.creditsPerPeriod,
            interval: subscription.interval,
            currentPeriodEnd: subscription.currentPeriodEnd,
            status: subscription.status,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          }
        : null,
      credits: bootstrap.credits,
    });
  } catch (error) {
    console.error("[API] Failed to fetch current subscription and credits:", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to fetch current subscription and credits",
      500
    );
  }
}
