import type { AnalyticsClient } from "../core/analytics-client";
import type { AnalyticsContext, AnalyticsParams } from "../core/analytics-types";

interface PaymentEventOptions {
  params?: AnalyticsParams;
  context?: AnalyticsContext;
  dedupeKey?: string;
}

export function trackCheckoutStarted(client: AnalyticsClient, options: PaymentEventOptions = {}) {
  client.track({
    name: "checkout_started",
    context: options.context,
    params: options.params,
    dedupeKey: options.dedupeKey,
  });
}

export function trackPurchaseCompleted(client: AnalyticsClient, options: PaymentEventOptions = {}) {
  client.track({
    name: "purchase",
    context: options.context,
    params: {
      transport_type: "beacon",
      ...(options.params || {}),
    },
    dedupeKey: options.dedupeKey,
  });
}
