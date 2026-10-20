import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@markless/shared/src/lib/config/env";
import { cleanupExpiredAnonymousTranscriptionJobs } from "@markless/server/src/lib/transcriptions/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 仅作为 fallback 使用的内部接口。
// 当前生产主路径由 Trigger.dev task 直接调用
// cleanupExpiredAnonymousTranscriptionJobs()。
// 保留这个路由仅用于：
// 1. 手工补跑 / 重放
// 2. 本地调试
// 3. 需要临时绕过 Trigger 主路径时的应急运维
function isAuthorized(request: NextRequest) {
  const secret = getEnv("CRON_SECRET");
  if (!secret) {
    throw new Error("Missing CRON_SECRET");
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await cleanupExpiredAnonymousTranscriptionJobs();
    return NextResponse.json({
      success: true,
      result,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Transcriptions Cleanup Cron] Failed:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
