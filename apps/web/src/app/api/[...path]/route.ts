import type { NextRequest } from "next/server";
import { getEnv } from "@markless/shared/src/lib/config/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
]);

const RESPONSE_HEADERS_TO_STRIP = new Set([
  ...HOP_BY_HOP_HEADERS,
  "content-encoding",
]);

function normalizeBaseUrl(value?: string): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/\/$/, "");
  return normalized || null;
}

function getApiUpstreamBaseUrl(): string {
  const baseUrl =
    normalizeBaseUrl(getEnv("API_UPSTREAM_URL")) ||
    normalizeBaseUrl(getEnv("NEXT_PUBLIC_APP_URL")) ||
    normalizeBaseUrl(getEnv("BETTER_AUTH_URL"));

  if (!baseUrl) {
    throw new Error("Missing API upstream base URL");
  }

  return baseUrl;
}

function buildUpstreamUrl(request: NextRequest, pathSegments: string[]): string {
  const pathname = pathSegments.length > 0 ? pathSegments.join("/") : "";
  return `${getApiUpstreamBaseUrl()}/api/${pathname}${request.nextUrl.search}`;
}

function buildForwardHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);

  for (const headerName of HOP_BY_HOP_HEADERS) {
    headers.delete(headerName);
  }

  headers.delete("host");

  const requestHost = request.headers.get("host");
  if (requestHost && !headers.has("x-forwarded-host")) {
    headers.set("x-forwarded-host", requestHost);
  }

  if (!headers.has("x-forwarded-proto")) {
    headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));
  }

  headers.set("accept-encoding", "identity");

  return headers;
}

async function proxyToApi(
  request: NextRequest,
  pathSegments: string[]
): Promise<Response> {
  const method = request.method.toUpperCase();
  const upstreamResponse = await fetch(buildUpstreamUrl(request, pathSegments), {
    method,
    headers: buildForwardHeaders(request),
    body:
      method === "GET" || method === "HEAD"
        ? undefined
        : await request.arrayBuffer(),
    redirect: "manual",
    cache: "no-store",
  });

  const responseHeaders = new Headers(upstreamResponse.headers);

  for (const headerName of RESPONSE_HEADERS_TO_STRIP) {
    responseHeaders.delete(headerName);
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

async function handleRequest(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { path } = await context.params;
    return proxyToApi(request, path);
  } catch (error) {
    console.error("[Web API Proxy] Upstream request failed:", error);

    return Response.json(
      {
        success: false,
        data: null,
        error: {
          code: "API_UPSTREAM_PROXY_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to proxy API request",
        },
      },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return handleRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleRequest(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return handleRequest(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleRequest(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return handleRequest(request, context);
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  return handleRequest(request, context);
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  return handleRequest(request, context);
}
