import type { NextRequest } from "next/server";

function normalizeOrigin(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getAllowedOrigins(request: NextRequest): Set<string> {
  const configuredOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS || "")
    .split(",")
    .map((value) => normalizeOrigin(value.trim()))
    .filter((value): value is string => Boolean(value));

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const requestOrigin = forwardedHost
    ? normalizeOrigin(`${forwardedProto}://${forwardedHost}`)
    : null;

  const defaults = [
    normalizeOrigin(process.env.NEXT_PUBLIC_WEB_URL),
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL),
    normalizeOrigin(process.env.NEXT_PUBLIC_AUTH_BASE_URL),
    normalizeOrigin(process.env.BETTER_AUTH_URL),
    requestOrigin,
  ].filter((value): value is string => Boolean(value));

  return new Set([...defaults, ...configuredOrigins]);
}

export function buildSseCorsHeaders(
  request: NextRequest
): Record<string, string> | null {
  const origin = normalizeOrigin(request.headers.get("origin"));
  if (!origin) {
    return null;
  }

  const allowedOrigins = getAllowedOrigins(request);
  if (!allowedOrigins.has(origin)) {
    return null;
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}
