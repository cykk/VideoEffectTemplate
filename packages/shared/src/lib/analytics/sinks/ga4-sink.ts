import type { AnalyticsDispatchPayload, AnalyticsSink } from "../core/analytics-types";

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

interface CreateGa4SinkOptions {
  measurementId?: string;
}

function isGa4Ready(measurementId?: string) {
  return typeof window !== "undefined" && Boolean(measurementId) && typeof window.gtag === "function";
}

export function createGa4Sink(options: CreateGa4SinkOptions = {}): AnalyticsSink {
  return {
    id: "ga4",
    track(payload: AnalyticsDispatchPayload) {
      if (!isGa4Ready(options.measurementId)) {
        return;
      }

      window.gtag?.("event", payload.name, payload.finalParams);
    },
  };
}
