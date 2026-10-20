"use client";

import { trackCheckoutStarted, trackPurchaseCompleted } from "@markless/shared/src/lib/analytics";
import { getWebAnalyticsClient } from "@/lib/analytics/ga";

interface CheckoutStartedOptions {
    entrySurface?: string;
    productId: string;
    productType?: "one_time" | "subscription";
    value?: number;
    currency?: string;
    isAuthenticated?: boolean;
}

interface PurchaseCompletedOptions {
    transactionId: string;
    productId?: string;
    productName?: string;
    productType?: "one_time" | "subscription";
    value?: number;
    currency?: string;
    entrySurface?: string;
    dedupeKey?: string;
}

export function trackStarterCheckoutStarted(options: CheckoutStartedOptions) {
    trackCheckoutStarted(getWebAnalyticsClient(), {
        params: {
            entry_surface: options.entrySurface ?? "unknown",
            product_id: options.productId,
            product_type: options.productType,
            value: options.value,
            currency: options.currency,
            is_authenticated: options.isAuthenticated,
        },
    });
}

export function trackStarterPurchaseCompleted(options: PurchaseCompletedOptions) {
    trackPurchaseCompleted(getWebAnalyticsClient(), {
        dedupeKey: options.dedupeKey,
        params: {
            transaction_id: options.transactionId,
            product_id: options.productId,
            product_name: options.productName,
            product_type: options.productType,
            value: options.value,
            currency: options.currency,
            entry_surface: options.entrySurface,
        },
    });
}
