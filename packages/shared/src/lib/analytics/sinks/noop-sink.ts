import type { AnalyticsDispatchPayload, AnalyticsSink } from "../core/analytics-types";

export function createNoopSink(): AnalyticsSink {
  return {
    id: "noop",
    track(_payload: AnalyticsDispatchPayload) {
      return;
    },
  };
}
