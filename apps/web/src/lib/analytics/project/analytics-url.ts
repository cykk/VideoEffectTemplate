const MARKETING_QUERY_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
]);

export function isAnalyticsExcludedPath(pathname: string | null): boolean {
  return Boolean(
    pathname &&
      (pathname === "/admin" ||
        pathname.startsWith("/admin/") ||
        /^\/[^/]+\/admin(?:\/|$)/.test(pathname))
  );
}

export function normalizeAnalyticsPathname(pathname: string | null): string {
  const path = pathname || "/";

  return path;
}

export function getAnalyticsSearchParams(searchParams: URLSearchParams | null | undefined): string {
  const sanitized = new URLSearchParams();

  for (const [key, value] of new URLSearchParams(searchParams?.toString() || "")) {
    if (MARKETING_QUERY_PARAMS.has(key.toLowerCase())) {
      sanitized.append(key, value);
    }
  }

  return sanitized.toString();
}

export function buildAnalyticsLocation(pathname: string, search?: string): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return `${window.location.origin}${pathname}${search ? `?${search}` : ""}`;
}
