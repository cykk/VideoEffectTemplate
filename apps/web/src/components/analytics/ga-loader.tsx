"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { GA_READY_EVENT_NAME } from "@/lib/analytics/project";
import { getAnalyticsSearchParams, isAnalyticsExcludedPath } from "@/lib/analytics/project/analytics-url";

function shouldLoadGaForPathname(pathname: string | null) {
    if (!pathname) {
        return true;
    }

    return !isAnalyticsExcludedPath(pathname) && !/^\/[^/]+\/admin(?:\/|$)/.test(pathname);
}

interface GaLoaderProps {
    measurementId: string;
}

export function GaLoader({ measurementId }: GaLoaderProps) {
    const pathname = usePathname();
    const shouldLoad = useMemo(
        () => Boolean(measurementId) && shouldLoadGaForPathname(pathname),
        [measurementId, pathname],
    );

    if (!shouldLoad) {
        return null;
    }

    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
                strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
                {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    window.gtag = gtag;
                    gtag('js', new Date());
                    gtag('config', '${measurementId}', { send_page_view: false });
                    window.dispatchEvent(new Event('${GA_READY_EVENT_NAME}'));
                `}
            </Script>
        </>
    );
}

export function getAnalyticsSearchParamsForPageView(searchParams: URLSearchParams | null | undefined) {
    return getAnalyticsSearchParams(searchParams);
}
