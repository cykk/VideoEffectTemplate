import { AnalyticsDedupeStore } from "./analytics-dedupe";
import {
  buildAnalyticsPayload,
  mergeAnalyticsContext,
  sanitizeAnalyticsParams,
} from "./analytics-context";
import type {
  AnalyticsClientOptions,
  AnalyticsContextResolver,
  AnalyticsDispatchPayload,
  AnalyticsEvent,
  AnalyticsSink,
} from "./analytics-types";

export class AnalyticsDispatcher {
  private sinks: AnalyticsSink[];
  private contextResolver?: AnalyticsContextResolver;
  private readonly dedupeStore = new AnalyticsDedupeStore();
  private readonly debug: boolean;

  constructor(options: AnalyticsClientOptions = {}) {
    this.sinks = options.sinks || [];
    this.contextResolver = options.contextResolver;
    this.debug = options.debug === true;
  }

  registerSink(sink: AnalyticsSink) {
    this.sinks.push(sink);
  }

  setContextResolver(resolver?: AnalyticsContextResolver) {
    this.contextResolver = resolver;
  }

  track<Name extends string>(event: AnalyticsEvent<Name>) {
    if (this.dedupeStore.has(event.dedupeKey)) {
      return;
    }

    const resolvedContext = this.contextResolver?.() || {};
    const context = mergeAnalyticsContext(resolvedContext, event.context);
    const params = sanitizeAnalyticsParams(event.params || {});
    const finalParams = buildAnalyticsPayload(context, params);

    const payload: AnalyticsDispatchPayload<Name> = {
      name: event.name,
      params,
      context,
      finalParams,
      dedupeKey: event.dedupeKey,
    };

    if (this.debug && typeof console !== "undefined") {
      console.debug("[Analytics]", payload);
    }

    for (const sink of this.sinks) {
      sink.track(payload);
    }

    this.dedupeStore.add(event.dedupeKey);
  }
}
