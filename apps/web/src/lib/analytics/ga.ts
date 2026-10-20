"use client";

import {
    createAnalyticsClient,
    createGa4Sink,
} from "@markless/shared/src/lib/analytics";
import { resolveCurrentStarterAnalyticsContext } from "@/lib/analytics/project/starter-context";

declare global {
    interface Window {
        dataLayer: unknown[];
        gtag?: (
            command: "js" | "config" | "event",
            target: string | Date,
            params?: Record<string, unknown>,
        ) => void;
    }
}

export const GA_READY_EVENT_NAME = "markless:ga-ready";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "";

const analyticsClient = createAnalyticsClient({
    sinks: [
        createGa4Sink({
            measurementId: GA_MEASUREMENT_ID,
        }),
    ],
});
analyticsClient.setContextResolver(resolveCurrentStarterAnalyticsContext);

export function getGaMeasurementId() {
    return GA_MEASUREMENT_ID;
}

export function isGaReady() {
    return typeof window !== "undefined" && Boolean(GA_MEASUREMENT_ID) && typeof window.gtag === "function";
}

export function getWebAnalyticsClient() {
    return analyticsClient;
}
