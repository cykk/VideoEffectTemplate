import { NextRequest } from "next/server";
import { errorResponse, successResponse, unauthorizedResponse } from "@markless/shared/src/lib/api/response";
import { auth } from "@markless/server/src/lib/auth/server";
import { SUBSCRIPTION_STATUS } from "@markless/shared/src/constants/subscription";
import { SubscriptionService } from "@markless/server/src/lib/subscriptions/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return unauthorizedResponse();
    }

    const subscriptions = await SubscriptionService.getUserSubscriptions(
      session.user.id
    );
    const cancelledSubscription = subscriptions.find(
      (sub) =>
        sub.status === SUBSCRIPTION_STATUS.ACTIVE &&
        sub.cancelAtPeriodEnd === 1 &&
        new Date(sub.currentPeriodEnd) > new Date()
    );

    if (!cancelledSubscription) {
      return errorResponse(
        "INVALID_PARAMS",
        "No scheduled cancellation found",
        404
      );
    }

    await SubscriptionService.resumeSubscription(
      cancelledSubscription.providerSubscriptionId
    );

    return successResponse({ resumed: true });
  } catch (error) {
    console.error("[API] Failed to resume subscription:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to resume subscription", 500);
  }
}
