import { NextRequest, NextResponse } from "next/server";
import { auth } from "@markless/server/src/lib/auth/server";
import { successResponse, errorResponse } from "@markless/shared/src/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (session?.user?.id) {
      return successResponse({
        ready: true,
        authenticated: true,
        streamMode: "session" as const,
      });
    }

    return successResponse({
      ready: true,
      authenticated: false,
      streamMode: "session" as const,
    });
  } catch (error) {
    console.error("[Stream Bootstrap] Failed to prepare stream identity:", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to prepare stream identity",
      500
    );
  }
}
