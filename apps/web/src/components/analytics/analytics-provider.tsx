"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
    GA_READY_EVENT_NAME,
    isProjectGaReady,
    trackStarterPageView,
} from "@/lib/analytics/project";
import { useUserBootstrap } from "@/hooks/use-user-bootstrap";
import { getAnalyticsSearchParamsForPageView } from "@/components/analytics/ga-loader";
import { isAnalyticsExcludedPath, normalizeAnalyticsPathname } from "@/lib/analytics/project/analytics-url";

export function AnalyticsProvider() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { loading } = useUserBootstrap();
    const [gaReady, setGaReady] = useState(() => isProjectGaReady());
    const lastTrackedUrlRef = useRef<string | null>(null);

    useEffect(() => {
        if (gaReady) {
            return;
        }

        const handleGaReady = () => {
            setGaReady(true);
        };

        window.addEventListener(GA_READY_EVENT_NAME, handleGaReady);

        if (isProjectGaReady()) {
            setGaReady(true);
        }

        return () => {
            window.removeEventListener(GA_READY_EVENT_NAME, handleGaReady);
        };
    }, [gaReady]);

    useEffect(() => {
        if (loading || !gaReady) {
            return;
        }

        if (isAnalyticsExcludedPath(pathname)) {
            return;
        }

        const search = getAnalyticsSearchParamsForPageView(searchParams);
        const normalizedPathname = normalizeAnalyticsPathname(pathname);
        const urlKey = `${normalizedPathname}${search ? `?${search}` : ""}`;

        if (lastTrackedUrlRef.current === urlKey) {
            return;
        }

        lastTrackedUrlRef.current = urlKey;

        trackStarterPageView({
            pathname,
            search,
            title: typeof document !== "undefined" ? document.title : undefined,
        });
    }, [gaReady, loading, pathname, searchParams]);

    return null;
}
