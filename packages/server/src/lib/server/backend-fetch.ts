import { buildApiUrl } from "@markless/shared/src/lib/config/urls";
import { getEnv } from "@markless/shared/src/lib/config/env";
import type { UserPricingTier } from "@markless/shared/src/lib/products/config";
import type { UserBootstrapData } from "@markless/server/src/lib/user/bootstrap-service";

const DEFAULT_BACKEND_TIMEOUT_MS = 15000;
const HTML_CONTENT_TYPE = "text/html";

type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  } | null;
};

type BackendFetchInit = RequestInit & {
  timeoutMs?: number;
};

export class BackendApiError extends Error {
  status: number;
  code: string;
  path: string;
  details?: unknown;

  constructor(options: {
    message: string;
    status: number;
    code: string;
    path: string;
    details?: unknown;
  }) {
    super(options.message);
    this.name = "BackendApiError";
    this.status = options.status;
    this.code = options.code;
    this.path = options.path;
    this.details = options.details;
  }
}

export function isBackendApiError(error: unknown): error is BackendApiError {
  return error instanceof BackendApiError;
}

function normalizeBaseUrl(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/\/$/, "");
  return normalized || null;
}

function getRequestOrigin(requestHeaders: Headers): string | null {
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const forwardedHost =
    requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");

  if (forwardedProto && forwardedHost) {
    return normalizeBaseUrl(`${forwardedProto}://${forwardedHost}`);
  }

  const referer = requestHeaders.get("referer") || requestHeaders.get("x-url");
  if (!referer) {
    return null;
  }

  try {
    return normalizeBaseUrl(new URL(referer).origin);
  } catch {
    return null;
  }
}

function getCandidateApiBaseUrls(requestHeaders: Headers): string[] {
  const candidates = new Set<string>();

  const internalApiBaseUrl = normalizeBaseUrl(getEnv("INTERNAL_API_BASE_URL"));
  if (internalApiBaseUrl) {
    candidates.add(internalApiBaseUrl);
  }

  const configuredApiBaseUrl = normalizeBaseUrl(
    getEnv("NEXT_PUBLIC_API_BASE_URL") || getEnv("NEXT_PUBLIC_APP_URL")
  );
  if (configuredApiBaseUrl) {
    candidates.add(configuredApiBaseUrl);
  }

  const requestOrigin = getRequestOrigin(requestHeaders);
  if (requestOrigin) {
    candidates.add(requestOrigin);
  }

  const fallbackBaseUrl = normalizeBaseUrl(buildApiUrl());
  if (fallbackBaseUrl) {
    candidates.add(fallbackBaseUrl);
  }

  return Array.from(candidates);
}

function buildForwardHeaders(requestHeaders: Headers): HeadersInit {
  const headers: Record<string, string> = {
    accept: "application/json",
  };

  const cookie = requestHeaders.get("cookie");
  if (cookie) {
    headers.cookie = cookie;
  }

  const userAgent = requestHeaders.get("user-agent");
  if (userAgent) {
    headers["user-agent"] = userAgent;
  }

  const forwardedFor = requestHeaders.get("x-forwarded-for");
  if (forwardedFor) {
    headers["x-forwarded-for"] = forwardedFor;
  }

  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  if (forwardedProto) {
    headers["x-forwarded-proto"] = forwardedProto;
  }

  const forwardedHost =
    requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  if (forwardedHost) {
    headers["x-forwarded-host"] = forwardedHost;
  }

  return headers;
}

function mergeHeaders(baseHeaders: HeadersInit, extraHeaders?: HeadersInit): Headers {
  const merged = new Headers(baseHeaders);
  if (extraHeaders) {
    const extras = new Headers(extraHeaders);
    extras.forEach((value, key) => {
      merged.set(key, value);
    });
  }
  return merged;
}

function tryParseEnvelope<T>(rawText: string): ApiEnvelope<T> | null {
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText) as ApiEnvelope<T>;
  } catch {
    return null;
  }
}

function extractResponseErrorMessage(
  responseText: string,
  contentType: string | null,
  status: number,
  requestUrl: string,
  payload?: ApiEnvelope<unknown> | null
): string {
  if (payload?.error?.message) {
    return payload.error.message;
  }

  if (contentType?.includes(HTML_CONTENT_TYPE)) {
    return `Backend returned HTML instead of JSON (${status}) for ${requestUrl}`;
  }

  if (responseText) {
    return responseText;
  }

  return `Backend request failed with status ${status}`;
}

async function fetchBackendJson<T>(
  path: string,
  requestHeaders: Headers,
  init: BackendFetchInit = {}
): Promise<T> {
  const { timeoutMs = DEFAULT_BACKEND_TIMEOUT_MS, headers, ...restInit } = init;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const candidateBaseUrls = getCandidateApiBaseUrls(requestHeaders);
  let lastError: BackendApiError | null = null;

  try {
    for (const baseUrl of candidateBaseUrls) {
      const requestUrl = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

      try {
        const response = await fetch(requestUrl, {
          ...restInit,
          headers: mergeHeaders(buildForwardHeaders(requestHeaders), headers),
          cache: "no-store",
          signal: restInit.signal ?? controller.signal,
        });

        const responseText = await response.text();
        const payload = tryParseEnvelope<T>(responseText);
        const contentType = response.headers.get("content-type");

        if (!response.ok) {
          throw new BackendApiError({
            message: extractResponseErrorMessage(
              responseText,
              contentType,
              response.status,
              requestUrl,
              payload
            ),
            status: response.status,
            code: payload?.error?.code || `HTTP_${response.status}`,
            path,
            details: payload?.error?.details,
          });
        }

        if (!payload) {
          throw new BackendApiError({
            message: `Invalid backend JSON response from ${requestUrl}`,
            status: response.status,
            code: "INVALID_BACKEND_RESPONSE",
            path,
          });
        }

        if (!payload.success) {
          throw new BackendApiError({
            message: payload.error?.message || "Backend request failed",
            status: response.status,
            code: payload.error?.code || "BACKEND_REQUEST_FAILED",
            path,
            details: payload.error?.details,
          });
        }

        return payload.data as T;
      } catch (error) {
        if (!isBackendApiError(error)) {
          throw error;
        }

        lastError = error;

        const shouldTryNextCandidate =
          error.status === 404 ||
          error.code === "INVALID_BACKEND_RESPONSE" ||
          error.code === "BACKEND_NETWORK_ERROR";

        if (!shouldTryNextCandidate) {
          throw error;
        }
      }
    }

    if (lastError) {
      throw lastError;
    }

    throw new BackendApiError({
      message: `No backend base URL available for ${path}`,
      status: 500,
      code: "BACKEND_URL_NOT_RESOLVED",
      path,
    });
  } catch (error) {
    if (isBackendApiError(error)) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new BackendApiError({
        message: `Backend request timed out after ${timeoutMs}ms`,
        status: 504,
        code: "BACKEND_TIMEOUT",
        path,
      });
    }

    throw new BackendApiError({
      message: error instanceof Error ? error.message : "Unknown backend request error",
      status: 500,
      code: "BACKEND_NETWORK_ERROR",
      path,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function postBackendJson<TResponse, TBody = undefined>(
  path: string,
  requestHeaders: Headers,
  body?: TBody,
  init: BackendFetchInit = {}
): Promise<TResponse> {
  return fetchBackendJson<TResponse>(path, requestHeaders, {
    ...init,
    method: init.method || "POST",
    headers: mergeHeaders(
      {
        "content-type": "application/json",
      },
      init.headers
    ),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function fetchUserBootstrapFromBackend(
  requestHeaders: Headers
): Promise<UserBootstrapData> {
  return fetchBackendJson<UserBootstrapData>(
    "/api/user/bootstrap",
    requestHeaders
  );
}

export async function fetchCreditsHistoryFromBackend(
  requestHeaders: Headers
): Promise<{
  balance: { total: number; plan: number; pack: number; bonus: number };
  history: Array<{
    id: string;
    type: string;
    amount: number;
    date: string;
    description: string;
  }>;
}> {
  return fetchBackendJson("/api/user/credits/history", requestHeaders);
}

export async function fetchOrdersHistoryFromBackend(
  requestHeaders: Headers,
  page: number,
  locale: string
): Promise<{
  data: Array<{
    id: string;
    orderNumber: string;
    date: string;
    product: string;
    period: string | null;
    amount: string;
    status: string;
    statusLabel: string;
    statusColor: string;
    paymentMethod: string;
  }>;
  pagination: {
    totalCount: number;
    totalPages: number;
    currentPage: number;
    hasPrev: boolean;
    hasNext: boolean;
  };
}> {
  const query = new URLSearchParams({
    page: String(page),
    locale,
  });

  return fetchBackendJson(
    `/api/user/orders/history?${query.toString()}`,
    requestHeaders
  );
}

export async function fetchSubscriptionDetailFromBackend(
  requestHeaders: Headers
): Promise<{
  subscription: {
    planName: string;
    status: string;
    interval: string;
    currentPeriodEnd: string | null;
    creditsPerPeriod: number;
    price: number;
    cancelAtPeriodEnd: number;
  } | null;
}> {
  return fetchBackendJson("/api/user/subscription/detail", requestHeaders);
}

export async function fetchPricingSummaryFromBackend(
  requestHeaders: Headers
): Promise<{
  authenticated: boolean;
  userPricingTier: UserPricingTier;
  currentCredits: number;
  subscriptionInfo: {
    creditsPerPeriod: number;
    interval: "month" | "year";
    currentPeriodEnd: string;
    status?: string;
    cancelAtPeriodEnd?: number;
  } | null;
}> {
  return fetchBackendJson("/api/user/pricing/summary", requestHeaders);
}

export async function cancelUserSubscriptionFromBackend(
  requestHeaders: Headers
): Promise<{ cancelled: boolean }> {
  return postBackendJson("/api/user/subscription/cancel", requestHeaders);
}

export async function resumeUserSubscriptionFromBackend(
  requestHeaders: Headers
): Promise<{ resumed: boolean }> {
  return postBackendJson("/api/user/subscription/resume", requestHeaders);
}
