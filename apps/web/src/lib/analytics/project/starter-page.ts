"use client";

import { trackPageView as trackSharedPageView } from "@markless/shared/src/lib/analytics";
import { getWebAnalyticsClient } from "@/lib/analytics/ga";
import { resolveStarterAnalyticsContext } from "@/lib/analytics/project/starter-context";
import { buildAnalyticsLocation, normalizeAnalyticsPathname } from "@/lib/analytics/project/analytics-url";

export function trackStarterPageView({
    pathname,
    search,
    title,
}: {
    pathname: string | null;
    search?: string;
    title?: string;
}) {
    const normalizedPathname = normalizeAnalyticsPathname(pathname);
    const context = resolveStarterAnalyticsContext(normalizedPathname);
    const pagePath = `${normalizedPathname}${search ? `?${search}` : ""}`;

    trackSharedPageView(getWebAnalyticsClient(), {
        title: title || (typeof document !== "undefined" ? document.title : undefined),
        path: pagePath,
        location: buildAnalyticsLocation(normalizedPathname, search),
        params: {
            page_type: context.pageType,
            source_page: context.sourcePage,
            locale: context.locale,
        },
    });
}
