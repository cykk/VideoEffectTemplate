import type { AnalyticsClient } from "../core/analytics-client";
import type { AnalyticsContext, AnalyticsParams } from "../core/analytics-types";

interface TaskEventOptions {
  params?: AnalyticsParams;
  context?: AnalyticsContext;
  dedupeKey?: string;
}

export function trackTaskStarted(client: AnalyticsClient, options: TaskEventOptions = {}) {
  client.track({
    name: "process_started",
    context: options.context,
    params: options.params,
    dedupeKey: options.dedupeKey,
  });
}

export function trackTaskSucceeded(client: AnalyticsClient, options: TaskEventOptions = {}) {
  client.track({
    name: "process_succeeded",
    context: options.context,
    params: options.params,
    dedupeKey: options.dedupeKey,
  });
}

export function trackTaskFailed(client: AnalyticsClient, options: TaskEventOptions = {}) {
  client.track({
    name: "process_failed",
    context: options.context,
    params: options.params,
    dedupeKey: options.dedupeKey,
  });
}
