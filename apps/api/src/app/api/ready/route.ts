import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getReadiness } from "@markless/server/src/lib/health/readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const readinessHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "X-Robots-Tag": "noindex",
};

async function buildReadinessResponse(includeBody: boolean) {
  const readiness = await getReadiness();

  if (readiness.ready) {
    return includeBody
      ? NextResponse.json(
          { ok: true, status: "ready", service: "api" },
          { status: 200, headers: readinessHeaders }
        )
      : new Response(null, { status: 200, headers: readinessHeaders });
  }

  const requestId = `ready_${randomUUID()}`;
  console.error("[Readiness] Check failed", {
    event: "readiness_failed",
    requestId,
    durationMs: readiness.durationMs,
    checks: readiness.checks,
  });

  const headers = {
    ...readinessHeaders,
    "Retry-After": "30",
    "X-Request-Id": requestId,
  };

  return includeBody
    ? NextResponse.json(
        { ok: false, status: "not_ready", service: "api", requestId },
        { status: 503, headers }
      )
    : new Response(null, { status: 503, headers });
}

export async function GET() {
  return buildReadinessResponse(true);
}

export async function HEAD() {
  return buildReadinessResponse(false);
}
