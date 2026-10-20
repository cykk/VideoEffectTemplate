/**
 * Client-side Providers
 * Wraps the app with client-side functionality like React Query and toast UI.
 */

"use client";

import { Suspense } from "react";
import { AnalyticsProvider } from "@/components/analytics/analytics-provider";
import { GaLoader } from "@/components/analytics/ga-loader";
import { Toaster } from "@/components/ui/sonner";
import { CreditsAddedOverlay } from "@/components/payment/credits-added-overlay";
import { QueryProvider } from "@/providers/query-provider";

export function ClientProviders({ children }: { children: React.ReactNode }) {
    const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "";

    return (
        <QueryProvider>
            <Suspense fallback={null}>
                <GaLoader measurementId={gaMeasurementId} />
            </Suspense>
            <Toaster position="top-center" expand={true} duration={4000} richColors />
            <Suspense fallback={null}>
                <AnalyticsProvider />
            </Suspense>
            {children}
            <Suspense fallback={null}>
                <CreditsAddedOverlay />
            </Suspense>
        </QueryProvider>
    );
}
