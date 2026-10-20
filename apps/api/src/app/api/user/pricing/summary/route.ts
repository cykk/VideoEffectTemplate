import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@markless/shared/src/lib/api/response";
import { getUserPricingTier, type UserPricingTier } from "@markless/shared/src/lib/products/config";
import { getUserSubscriptionData } from "@markless/server/src/lib/subscriptions/data/fetch";
import { getUserBootstrap } from "@markless/server/src/lib/user/bootstrap-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const bootstrap = await getUserBootstrap(req);

    if (!bootstrap.authenticated || !bootstrap.user) {
      return successResponse({
        authenticated: false,
        userPricingTier: "free" as UserPricingTier,
        currentCredits: 0,
        subscriptionInfo: null,
      });
    }

    let userPricingTier: UserPricingTier = "free";
    let subscriptionInfo: {
      creditsPerPeriod: number;
      interval: "month" | "year";
      currentPeriodEnd: string;
      status?: string;
      cancelAtPeriodEnd?: number;
    } | null = null;

    if (bootstrap.subscription) {
      userPricingTier = getUserPricingTier(bootstrap.subscription.planId);

      const subscription = await getUserSubscriptionData(bootstrap.user.id);
      if (subscription?.currentPeriodEnd) {
        subscriptionInfo = {
          creditsPerPeriod: subscription.creditsPerPeriod,
          interval: subscription.interval as "month" | "year",
          currentPeriodEnd: new Date(subscription.currentPeriodEnd).toISOString(),
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        };
      }
    }

    return successResponse({
      authenticated: true,
      userPricingTier,
      currentCredits: bootstrap.credits,
      subscriptionInfo,
    });
  } catch (error) {
    console.error("[API] Failed to build pricing summary:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to build pricing summary", 500);
  }
}
