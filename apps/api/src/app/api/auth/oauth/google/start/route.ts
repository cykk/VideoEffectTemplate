import { NextRequest, NextResponse } from "next/server";

import { getEnv } from "@markless/shared/src/lib/config/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeBaseUrl(value?: string): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/\/$/, "");
  return normalized || null;
}

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

function getAuthBaseUrl(): string | null {
  return (
    normalizeBaseUrl(getEnv("BETTER_AUTH_URL")) ||
    normalizeBaseUrl(getEnv("NEXT_PUBLIC_APP_URL"))
  );
}

function getAllowedOrigins(request: NextRequest): Set<string> {
  const configuredOrigins = (getEnv("BETTER_AUTH_TRUSTED_ORIGINS") || "")
    .split(",")
    .map((value) => normalizeOrigin(value.trim()))
    .filter((value): value is string => Boolean(value));

  const origins = [
    normalizeOrigin(getEnv("NEXT_PUBLIC_WEB_URL")),
    normalizeOrigin(getEnv("NEXT_PUBLIC_APP_URL")),
    normalizeOrigin(getEnv("BETTER_AUTH_URL")),
    ...configuredOrigins,
  ].filter((value): value is string => Boolean(value));

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (forwardedProto && forwardedHost) {
    const requestOrigin = normalizeOrigin(`${forwardedProto}://${forwardedHost}`);
    if (requestOrigin) {
      origins.push(requestOrigin);
    }
  }

  return new Set(origins);
}

function readSetCookieHeaders(response: Response): string[] {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie().filter(Boolean);
  }

  const singleHeader = response.headers.get("set-cookie");
  return singleHeader ? [singleHeader] : [];
}

export async function GET(request: NextRequest): Promise<Response> {
  const callbackURL = request.nextUrl.searchParams.get("callbackURL")?.trim();
  if (!callbackURL) {
    return NextResponse.json(
      { error: "Missing callbackURL" },
      { status: 400 },
    );
  }

  const callbackOrigin = normalizeOrigin(callbackURL);
  const allowedOrigins = getAllowedOrigins(request);
  if (!callbackOrigin || !allowedOrigins.has(callbackOrigin)) {
    console.error("[AuthDebug][Start] Invalid callbackURL", {
      callbackURL,
      callbackOrigin,
      allowedOrigins: Array.from(allowedOrigins),
    });

    return NextResponse.json(
      { error: "Invalid callbackURL" },
      { status: 400 },
    );
  }

  const authBaseUrl = getAuthBaseUrl();
  if (!authBaseUrl) {
    console.error("[AuthDebug][Start] Auth base URL is not configured");
    return NextResponse.json(
      { error: "Auth service is not configured" },
      { status: 500 },
    );
  }

  const signInUrl = `${authBaseUrl}/api/auth/sign-in/social`;

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(signInUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        provider: "google",
        callbackURL,
        disableRedirect: true,
      }),
      cache: "no-store",
    });
  } catch (error) {
    console.error("[AuthDebug][Start] Failed to call Better Auth", {
      callbackURL,
      signInUrl,
      error,
    });

    return NextResponse.json(
      { error: "Failed to start OAuth" },
      { status: 500 },
    );
  }

  const responseBody = (await upstreamResponse.json().catch(() => null)) as
    | { url?: string }
    | null;

  const redirectUrl = responseBody?.url;
  const setCookieHeaders = readSetCookieHeaders(upstreamResponse);

  if (!upstreamResponse.ok || !redirectUrl) {
    console.error("[AuthDebug][Start] Invalid Better Auth response", {
      callbackURL,
      signInUrl,
      status: upstreamResponse.status,
      hasRedirectUrl: Boolean(redirectUrl),
      setCookieCount: setCookieHeaders.length,
    });

    return NextResponse.json(
      { error: "Invalid Better Auth response" },
      { status: 500 },
    );
  }

  const redirectResponse = NextResponse.redirect(redirectUrl, 302);
  redirectResponse.headers.set("cache-control", "no-store");

  for (const setCookieHeader of setCookieHeaders) {
    redirectResponse.headers.append("set-cookie", setCookieHeader);
  }

  return redirectResponse;
}
