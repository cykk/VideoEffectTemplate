import { getClientPublicEnv } from "@markless/shared/src/lib/config/client-env";

function normalizeBaseUrl(value?: string): string {
  return (value || "").trim().replace(/\/$/, "");
}

function joinUrl(baseUrl: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizeBaseUrl(baseUrl)}${normalizedPath}`;
}

function getWindowOrigin(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.location.origin;
}

export function getClientWebBaseUrl(): string {
  return normalizeBaseUrl(getClientPublicEnv("NEXT_PUBLIC_WEB_URL") || getWindowOrigin());
}

export function getClientApiBaseUrl(): string {
  return normalizeBaseUrl(
    getClientPublicEnv("NEXT_PUBLIC_BROWSER_API_BASE_URL") ||
      getWindowOrigin()
  );
}

export function getClientAuthBaseUrl(): string {
  return normalizeBaseUrl(
    getClientPublicEnv("NEXT_PUBLIC_BROWSER_AUTH_BASE_URL") ||
      getClientApiBaseUrl()
  );
}

export function getClientSseBaseUrl(): string {
  return normalizeBaseUrl(
    getClientPublicEnv("NEXT_PUBLIC_BROWSER_SSE_BASE_URL") ||
      getClientApiBaseUrl()
  );
}

export function buildClientApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return joinUrl(getClientApiBaseUrl(), path);
}

export function buildClientSseUrl(path: string = "/api/events/stream/user"): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const sseBaseUrl = getClientSseBaseUrl();
  if (sseBaseUrl) {
    return joinUrl(sseBaseUrl, path);
  }

  const origin = getWindowOrigin();
  if (origin) {
    return joinUrl(origin, path);
  }

  return joinUrl(getClientApiBaseUrl(), path);
}

export function isCrossOriginClientUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) {
    return false;
  }

  try {
    const targetUrl = new URL(url);
    const currentOrigin = getWindowOrigin();
    if (!currentOrigin) {
      return false;
    }
    return targetUrl.origin !== currentOrigin;
  } catch {
    return false;
  }
}

export async function apiFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const url = buildClientApiUrl(input);

  return fetch(url, {
    ...init,
    credentials: init.credentials ?? "include",
    mode: init.mode ?? (isCrossOriginClientUrl(url) ? "cors" : undefined),
  });
}
