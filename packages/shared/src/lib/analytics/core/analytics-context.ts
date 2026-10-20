import type { AnalyticsContext, AnalyticsParams } from "./analytics-types";

export function sanitizeAnalyticsParams<T extends AnalyticsParams>(params: T): T {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "")
  ) as T;
}

export function mergeAnalyticsContext(
  baseContext?: AnalyticsContext | null,
  eventContext?: AnalyticsContext | null
): AnalyticsContext {
  return sanitizeAnalyticsParams({
    ...(baseContext || {}),
    ...(eventContext || {}),
  });
}

export function buildAnalyticsPayload(
  context: AnalyticsContext,
  params?: AnalyticsParams
): AnalyticsParams {
  return sanitizeAnalyticsParams({
    ...context,
    ...(params || {}),
  });
}
