import type { AnalyticsDispatchPayload, AnalyticsSink } from "../core/analytics-types";

export function createConsoleSink(prefix = "[Analytics]"): AnalyticsSink {
  return {
    id: "console",
    track(payload: AnalyticsDispatchPayload) {
      if (typeof console === "undefined") {
        return;
      }

      console.info(prefix, payload.name, payload.finalParams);
    },
  };
}
