import { NextRequest } from "next/server";
import { errorResponse, successResponse, unauthorizedResponse } from "@markless/shared/src/lib/api/response";
import { auth } from "@markless/server/src/lib/auth/server";
import { SubscriptionService } from "@markless/server/src/lib/subscriptions/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return unauthorizedResponse();
    }

    const subscription = await SubscriptionService.getUserActiveSubscription(
      session.user.id
    );
    if (!subscription) {
      return errorResponse("INVALID_PARAMS", "No active subscription found", 404);
    }

    await SubscriptionService.cancelSubscription(
      subscription.providerSubscriptionId,
      true
    );

    return successResponse({ cancelled: true });
  } catch (error) {
    console.error("[API] Failed to cancel subscription:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to cancel subscription", 500);
  }
}
