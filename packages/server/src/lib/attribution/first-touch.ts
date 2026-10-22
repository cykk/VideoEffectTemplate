import { userAttributions } from "@markless/server/src/lib/db/schema";
import { db } from "@markless/server/src/lib/db/client";

export const FIRST_TOUCH_COOKIE = "markless_first_touch";
const MAX_VALUE_LENGTH = 200;
const MAX_PATH_LENGTH = 500;

export type FirstTouch = {
  firstSourceHost: string | null;
  firstReferrerHost: string | null;
  firstLandingPath: string | null;
  firstUtmSource: string | null;
  firstUtmMedium: string | null;
  firstUtmCampaign: string | null;
  firstUtmTerm: string | null;
  firstUtmContent: string | null;
  countryCode: string | null;
  capturedAt: string;
};

function clean(value: string | null | undefined, max = MAX_VALUE_LENGTH): string | null {
  if (!value) return null;
  const normalized = value.trim().replace(/[\u0000-\u001f\u007f]/g, "");
  return normalized ? normalized.slice(0, max) : null;
}

function hostFromUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    return host.length <= MAX_VALUE_LENGTH ? host : null;
  } catch {
    return null;
  }
}

function countryFromRequest(request: Request): string | null {
  const value = request.headers.get("cf-ipcountry") ??
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("x-country-code");
  const country = value?.trim().toUpperCase();
  return country && /^[A-Z]{2}$/.test(country) && country !== "XX" ? country : null;
}

export function captureFirstTouch(request: Request): FirstTouch {
  const url = new URL(request.url);
  const referrer = request.headers.get("referer");
  const referrerHost = hostFromUrl(referrer);
  const requestHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || url.host;
  const clientSourceHost = hostFromUrl(`https://${url.searchParams.get("_source_host") || ""}`);
  const sourceHost = clientSourceHost || clean(requestHost.toLowerCase().replace(/^www\./, ""));
  const path = url.pathname.startsWith("/") ? url.pathname.slice(0, MAX_PATH_LENGTH) : "/";
  const param = (name: string) => clean(url.searchParams.get(name));

  return {
    firstSourceHost: sourceHost,
    firstReferrerHost: referrerHost,
    firstLandingPath: path,
    firstUtmSource: param("utm_source"),
    firstUtmMedium: param("utm_medium"),
    firstUtmCampaign: param("utm_campaign"),
    firstUtmTerm: param("utm_term"),
    firstUtmContent: param("utm_content"),
    countryCode: countryFromRequest(request),
    capturedAt: new Date().toISOString(),
  };
}

export function parseFirstTouch(value: string | undefined): FirstTouch | null {
  if (!value || value.length > 4096) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<FirstTouch>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.capturedAt !== "string") return null;
    return {
      firstSourceHost: clean(parsed.firstSourceHost), firstReferrerHost: clean(parsed.firstReferrerHost),
      firstLandingPath: typeof parsed.firstLandingPath === "string" && parsed.firstLandingPath.startsWith("/")
        ? parsed.firstLandingPath.slice(0, MAX_PATH_LENGTH) : null,
      firstUtmSource: clean(parsed.firstUtmSource), firstUtmMedium: clean(parsed.firstUtmMedium),
      firstUtmCampaign: clean(parsed.firstUtmCampaign), firstUtmTerm: clean(parsed.firstUtmTerm),
      firstUtmContent: clean(parsed.firstUtmContent),
      countryCode: parsed.countryCode && /^[A-Z]{2}$/.test(parsed.countryCode) ? parsed.countryCode : null,
      capturedAt: parsed.capturedAt,
    };
  } catch { return null; }
}

export async function bindFirstTouch(userId: string, touch: FirstTouch | null): Promise<void> {
  if (!touch) return;
  await db.insert(userAttributions).values({ userId, ...touch, capturedAt: new Date(touch.capturedAt) })
    .onConflictDoNothing({ target: userAttributions.userId });
}

export function getRequestFromAuthContext(context: unknown): Request | null {
  if (!context || typeof context !== "object") return null;
  const request = (context as { request?: unknown }).request;
  return request instanceof Request ? request : null;
}
