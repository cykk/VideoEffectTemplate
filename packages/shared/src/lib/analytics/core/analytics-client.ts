import { AnalyticsDispatcher } from "./analytics-dispatcher";
import type { AnalyticsClientOptions, AnalyticsContextResolver, AnalyticsEvent, AnalyticsSink } from "./analytics-types";

export interface AnalyticsClient {
  track: <Name extends string>(event: AnalyticsEvent<Name>) => void;
  registerSink: (sink: AnalyticsSink) => void;
  setContextResolver: (resolver?: AnalyticsContextResolver) => void;
}

export function createAnalyticsClient(options: AnalyticsClientOptions = {}): AnalyticsClient {
  const dispatcher = new AnalyticsDispatcher(options);

  return {
    track: (event) => dispatcher.track(event),
    registerSink: (sink) => dispatcher.registerSink(sink),
    setContextResolver: (resolver) => dispatcher.setContextResolver(resolver),
  };
}
