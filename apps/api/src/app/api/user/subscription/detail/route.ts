import { NextRequest } from "next/server";
import { errorResponse, successResponse, unauthorizedResponse } from "@markless/shared/src/lib/api/response";
import { auth } from "@markless/server/src/lib/auth/server";
import { getUserSubscriptionData } from "@markless/server/src/lib/subscriptions/data/fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return unauthorizedResponse();
    }

    const subscription = await getUserSubscriptionData(session.user.id);
    return successResponse({ subscription });
  } catch (error) {
    console.error("[API] Failed to fetch subscription detail:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to fetch subscription detail", 500);
  }
}
