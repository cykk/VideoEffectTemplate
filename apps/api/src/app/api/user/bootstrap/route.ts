import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@markless/shared/src/lib/api/response";
import { getUserBootstrap } from "@markless/server/src/lib/user/bootstrap-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const data = await getUserBootstrap(req);
    const response = successResponse({
      authenticated: data.authenticated,
      user: data.user,
      credits: data.credits,
      creditsBreakdown: data.creditsBreakdown,
      subscription: data.subscription,
      entitlements: data.entitlements,
      isAdmin: data.isAdmin,
    });

    return response;
  } catch (error) {
    console.error("[API] Failed to build user bootstrap:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to build user bootstrap", 500);
  }
}
