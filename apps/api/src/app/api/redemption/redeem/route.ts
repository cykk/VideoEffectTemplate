import { NextRequest } from "next/server";
import {
  errorResponse,
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "@markless/shared/src/lib/api/response";
import { auth } from "@markless/server/src/lib/auth/server";
import {
  RedemptionError,
  RedemptionService,
} from "@markless/server/src/lib/redemption/service";
import { checkRedemptionRateLimit } from "@markless/server/src/lib/redemption/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapRedemptionError(error: RedemptionError) {
  switch (error.code) {
    case "REDEMPTION_INVALID_CODE":
      return errorResponse(error.code, error.message, 400);
    case "REDEMPTION_ALREADY_REDEEMED":
      return errorResponse(error.code, error.message, 409);
    case "REDEMPTION_CODE_REVOKED":
      return errorResponse(error.code, error.message, 410);
    case "REDEMPTION_STACK_LIMIT_REACHED":
      return errorResponse(error.code, error.message, 403);
    case "FORBIDDEN":
      return errorResponse(error.code, error.message, 403);
    default:
      return errorResponse("INTERNAL_ERROR", error.message, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user) {
      return unauthorizedResponse();
    }

    const rateLimit = await checkRedemptionRateLimit(session.user.id);
    if (!rateLimit.success) {
      return errorResponse(
        "RATE_LIMITED",
        "Too many redemption attempts. Please try again later.",
        429
      );
    }

    const body = (await req.json()) as { code?: unknown };
    const code = typeof body.code === "string" ? body.code : "";

    if (!code.trim()) {
      return validationErrorResponse("Redemption code is required");
    }

    const result = await RedemptionService.redeemAppsumoCode(session.user.id, code);

    return successResponse(result, "Redemption successful");
  } catch (error) {
    if (error instanceof RedemptionError) {
      return mapRedemptionError(error);
    }

    console.error("[API] Failed to redeem AppSumo code:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to redeem code", 500);
  }
}
