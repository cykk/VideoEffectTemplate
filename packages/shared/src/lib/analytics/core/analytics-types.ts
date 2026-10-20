export type AnalyticsPrimitive = string | number | boolean;

export type AnalyticsParams = Record<string, AnalyticsPrimitive | null | undefined>;

export type AnalyticsContext = AnalyticsParams;

export interface AnalyticsEvent<Name extends string = string> {
  name: Name;
  params?: AnalyticsParams;
  context?: AnalyticsContext;
  dedupeKey?: string;
}

export interface AnalyticsDispatchPayload<Name extends string = string> {
  name: Name;
  params: AnalyticsParams;
  context: AnalyticsContext;
  finalParams: AnalyticsParams;
  dedupeKey?: string;
}

export interface AnalyticsSink {
  id: string;
  track: (payload: AnalyticsDispatchPayload) => void;
}

export type AnalyticsContextResolver = () => AnalyticsContext | null | undefined;

export interface AnalyticsClientOptions {
  sinks?: AnalyticsSink[];
  contextResolver?: AnalyticsContextResolver;
  debug?: boolean;
}
