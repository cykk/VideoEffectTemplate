import type { AnalyticsClient } from "../core/analytics-client";
import type { AnalyticsContext, AnalyticsParams } from "../core/analytics-types";

interface DownloadEventOptions {
  params?: AnalyticsParams;
  context?: AnalyticsContext;
}

export function trackDownloadClicked(client: AnalyticsClient, options: DownloadEventOptions = {}) {
  client.track({
    name: "download_click",
    context: options.context,
    params: options.params,
  });
}

export function trackDownloadSucceeded(client: AnalyticsClient, options: DownloadEventOptions = {}) {
  client.track({
    name: "download_success",
    context: options.context,
    params: options.params,
  });
}
