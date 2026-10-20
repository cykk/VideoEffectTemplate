import type { AnalyticsClient } from "../core/analytics-client";
import type { AnalyticsContext, AnalyticsParams } from "../core/analytics-types";

interface TrackPageViewOptions {
  title?: string;
  path?: string;
  location?: string;
  params?: AnalyticsParams;
  context?: AnalyticsContext;
}

export function trackPageView(client: AnalyticsClient, options: TrackPageViewOptions = {}) {
  client.track({
    name: "page_view",
    context: options.context,
    params: {
      page_title: options.title,
      page_path: options.path,
      page_location: options.location,
      ...(options.params || {}),
    },
  });
}
