import { NextRequest } from "next/server";
import {
  errorResponse,
  successResponse,
  unauthorizedResponse,
} from "@markless/shared/src/lib/api/response";
import { auth } from "@markless/server/src/lib/auth/server";
import { RedemptionService } from "@markless/server/src/lib/redemption/service";

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

    const status = await RedemptionService.getAppsumoStatus(session.user.id);

    return successResponse(status);
  } catch (error) {
    console.error("[API] Failed to fetch redemption status:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to fetch redemption status", 500);
  }
}
