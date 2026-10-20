import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@markless/shared/src/lib/config/env";
import { cleanupExpiredTranscriptionFailureArchives } from "@markless/server/src/lib/transcriptions/failure-archive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = getEnv("CRON_SECRET");
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json({
      success: true,
      result: await cleanupExpiredTranscriptionFailureArchives(),
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Failure Archive Cleanup Cron] Failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
