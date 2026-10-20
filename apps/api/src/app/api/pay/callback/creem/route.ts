import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { CreditService } from "@markless/server/src/lib/credits/service";
import { OrderService } from "@markless/server/src/lib/orders/service";
import { SubscriptionService } from "@markless/server/src/lib/subscriptions/service";
import { SUBSCRIPTION_STATUS } from "@markless/shared/src/constants/subscription";
import { getEnv } from "@markless/shared/src/lib/config/env";
import {
  getProductById,
  type SubscriptionProduct,
} from "@markless/shared/src/lib/products/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreemEvent {
  eventType?: string;
  type?: string;
  data?: unknown;
  requestId?: string;
  customer?: CreemCustomer;
  product?: CreemProduct;
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  subscriptionId?: string;
  reason?: string;
}

interface CreemCustomer {
  email?: string;
}

interface CreemProduct {
  id?: string;
}

interface CreemCheckoutData {
  requestId?: string;
  customer?: CreemCustomer;
  product?: CreemProduct;
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  reason?: string;
  subscriptionId?: string;
  checkoutId?: string;
  object?: {
    request_id?: string;
    customer?: CreemCustomer;
    metadata?: Record<string, unknown>;
    subscription?: CreemSubscriptionPayload;
    subscription_id?: string;
  };
}

interface CreemSubscriptionData {
  subscriptionId?: string;
  customer?: CreemCustomer;
  product?: CreemProduct;
  metadata?: Record<string, unknown>;
  reason?: string;
  subscription?: CreemSubscriptionPayload;
  object?: {
    subscription_id?: string;
    customer?: CreemCustomer;
    product?: CreemProduct;
    metadata?: Record<string, unknown>;
    reason?: string;
    subscription?: CreemSubscriptionPayload;
  };
  current_period_start?: unknown;
  current_period_start_date?: unknown;
  current_period_end?: unknown;
  current_period_end_date?: unknown;
}

type CreemSubscriptionPayload = {
  id?: string;
  metadata?: Record<string, unknown>;
  current_period_start?: unknown;
  current_period_start_date?: unknown;
  current_period_end?: unknown;
  current_period_end_date?: unknown;
  cancel_at?: unknown;
  cancel_at_date?: unknown;
};

type CreemRecord = Record<string, unknown>;

type ResolvedCreemSubscriptionPayload = {
  subscriptionId: string | null;
  subscription: CreemRecord;
  customer: CreemCustomer | undefined;
  product: CreemProduct | undefined;
  metadata: Record<string, unknown> | undefined;
  debug: Record<string, unknown>;
};

const SUBSCRIPTION_LOOKUP_RETRY_DELAYS_MS = [250, 500, 1_000] as const;

const parseCreemDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;

  if (typeof value === "number") {
    const ms = value < 1_000_000_000_000 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      const ms = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
      const date = new Date(ms);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
};

class CreemWebhookError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    status = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "CreemWebhookError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function normalizeSignature(signature: string): string {
  const normalized = signature.replace(/\s+/g, "").trim().toLowerCase();
  return normalized.startsWith("sha256=")
    ? normalized.slice("sha256=".length)
    : normalized;
}

function normalizeWebhookSecret(secret: string): string {
  const trimmed = secret.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ unserializable: true });
  }
}

function logWebhook(
  level: "info" | "warn" | "error",
  message: string,
  context: Record<string, unknown>
) {
  const logger =
    level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  logger(`[Creem Webhook] ${message} ${safeJson(context)}`);
}

function assertNonEmptyString(
  value: unknown,
  field: string,
  details?: Record<string, unknown>
): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  throw new CreemWebhookError(
    "INVALID_WEBHOOK_PAYLOAD",
    `Missing ${field}`,
    400,
    {
      field,
      ...details,
    }
  );
}

const resolveCreemPeriod = (
  payload: Record<string, unknown>,
  metadata?: Record<string, unknown>
) => {
  const periodStart = parseCreemDate(
    payload.current_period_start ??
      payload.current_period_start_date ??
      (metadata?.current_period_start as unknown) ??
      (metadata?.current_period_start_date as unknown)
  );
  const periodEnd = parseCreemDate(
    payload.current_period_end ??
      payload.current_period_end_date ??
      (metadata?.current_period_end as unknown) ??
      (metadata?.current_period_end_date as unknown)
  );

  return { periodStart, periodEnd };
};

const isLikelyCreemEventId = (value: unknown): boolean =>
  typeof value === "string" && /^evt_/i.test(value.trim());

const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asRecord = (value: unknown): CreemRecord | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as CreemRecord)
    : null;

const asOptionalRecord = (value: unknown): Record<string, unknown> | undefined =>
  asRecord(value) ?? undefined;

const asOptionalCustomer = (value: unknown): CreemCustomer | undefined =>
  asRecord(value) as CreemCustomer | null ?? undefined;

const asOptionalProduct = (value: unknown): CreemProduct | undefined =>
  asRecord(value) as CreemProduct | null ?? undefined;

const firstNonEventId = (...candidates: Array<string | null>): string | null =>
  candidates.find((candidate) => candidate && !isLikelyCreemEventId(candidate)) ?? null;

function resolveCreemSubscriptionPayload(
  data: CreemSubscriptionData
): ResolvedCreemSubscriptionPayload {
  const dataRecord = data as unknown as CreemRecord;
  const objectData = asRecord(dataRecord.object) ?? {};
  const nestedObjectSubscription = asRecord(objectData.subscription);
  const directSubscription = asRecord(dataRecord.subscription);

  // Creem subscription events can place the subscription directly in event.object.
  const subscription = nestedObjectSubscription ?? directSubscription ?? objectData;

  const candidates = {
    objectSubscriptionId: normalizeOptionalString(objectData.subscription_id),
    subscriptionObjectId: normalizeOptionalString(subscription.id),
    topLevelSubscriptionId: normalizeOptionalString(dataRecord.subscriptionId),
    eventId: normalizeOptionalString(dataRecord.id),
  };

  const subscriptionId = firstNonEventId(
    candidates.subscriptionObjectId,
    candidates.objectSubscriptionId,
    candidates.topLevelSubscriptionId
  );

  return {
    subscriptionId,
    subscription,
    customer: asOptionalCustomer(
      subscription.customer ?? objectData.customer ?? dataRecord.customer
    ),
    product: asOptionalProduct(subscription.product ?? objectData.product ?? dataRecord.product),
    metadata: asOptionalRecord(
      subscription.metadata ?? objectData.metadata ?? dataRecord.metadata
    ),
    debug: {
      ...candidates,
      objectKeys: Object.keys(objectData),
      subscriptionKeys: Object.keys(subscription),
      topLevelKeys: Object.keys(dataRecord),
      eventIdLooksLikeEvent: isLikelyCreemEventId(candidates.eventId),
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findSubscriptionWithShortRetry(subscriptionId: string) {
  let subscription = await SubscriptionService.findByProviderSubscriptionId(subscriptionId);

  for (const delayMs of SUBSCRIPTION_LOOKUP_RETRY_DELAYS_MS) {
    if (subscription) {
      return subscription;
    }

    await sleep(delayMs);
    subscription = await SubscriptionService.findByProviderSubscriptionId(subscriptionId);
  }

  return subscription;
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const rawSignature =
      request.headers.get("creem-signature") ||
      request.headers.get("x-creem-signature");
    const signature = rawSignature ? normalizeSignature(rawSignature) : null;
    const rawWebhookSecret = getEnv("CREEM_WEBHOOK_SECRET");
    const webhookSecret = rawWebhookSecret
      ? normalizeWebhookSecret(rawWebhookSecret)
      : undefined;

    logWebhook("info", "Callback received", {
      hasSignature: Boolean(signature),
      secretConfigured: Boolean(webhookSecret),
      secretLength: webhookSecret?.length ?? 0,
      payloadLength: payload.length,
      userAgent: request.headers.get("user-agent"),
      forwardedHost:
        request.headers.get("x-forwarded-host") || request.headers.get("host"),
      contentType: request.headers.get("content-type"),
      creemEnv: getEnv("CREEM_ENV") || "unset",
    });

    if (webhookSecret) {
      if (!signature) {
        throw new CreemWebhookError(
          "MISSING_SIGNATURE",
          "Missing creem-signature header",
          400
        );
      }

      const hmac = createHmac("sha256", webhookSecret);
      hmac.update(payload);
      const computedSignature = normalizeSignature(hmac.digest("hex"));

      const isValid =
        computedSignature.length === signature.length &&
        timingSafeEqual(
          Buffer.from(computedSignature, "utf8"),
          Buffer.from(signature, "utf8")
        );

      if (!isValid) {
        throw new CreemWebhookError(
          "INVALID_SIGNATURE",
          "Signature verification failed",
          400,
          {
            receivedSignatureLength: signature.length,
            computedSignatureLength: computedSignature.length,
            receivedSignaturePrefix: signature.slice(0, 8),
            computedSignaturePrefix: computedSignature.slice(0, 8),
          }
        );
      }
    } else {
      logWebhook("warn", "Signature verification skipped", {
        reason: "CREEM_WEBHOOK_SECRET is not configured",
      });
    }

    let event: CreemEvent;
    try {
      event = JSON.parse(payload) as CreemEvent;
    } catch (error) {
      throw new CreemWebhookError("INVALID_JSON", "Invalid JSON payload", 400, {
        parseError: error instanceof Error ? error.message : String(error),
      });
    }

    const eventId =
      typeof (event as { id?: unknown }).id === "string"
        ? (event as { id: string }).id
        : null;
    const eventType = event.eventType || event.type || "unknown";

    logWebhook("info", "Parsed event", {
      eventId,
      eventType,
    });

    const result = await handleCreemEvent(event);
    logWebhook("info", "Processed event successfully", {
      eventId,
      eventType,
      result,
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    if (error instanceof CreemWebhookError) {
      logWebhook("error", "Webhook processing failed", {
        code: error.code,
        message: error.message,
        status: error.status,
        details: error.details,
      });
      return NextResponse.json(
        {
          error: error.code,
          message: error.message,
          details: error.details,
        },
        { status: error.status }
      );
    }

    logWebhook("error", "Unhandled error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

async function handleCreemEvent(event: CreemEvent) {
  const eventType = event.eventType || event.type || "unknown";
  const eventId =
    typeof (event as { id?: unknown }).id === "string"
      ? (event as { id: string }).id
      : null;

  let data: Record<string, unknown>;
  if (event.data && typeof event.data === "object") {
    data = event.data as Record<string, unknown>;
  } else {
    const restData = { ...event };
    delete restData.eventType;
    delete restData.type;
    delete restData.data;
    data = restData as Record<string, unknown>;
  }

  logWebhook("info", "Handling event", {
    eventId,
    eventType,
    hasData: Boolean(event.data),
    dataKeys: Object.keys(data),
  });

  switch (eventType) {
    case "checkout.completed":
      return handleCheckoutCompleted(data as CreemCheckoutData);
    case "checkout.failed":
      return handleCheckoutFailed(data as CreemCheckoutData);
    case "subscription.paid":
      return handleSubscriptionPaid(data as CreemSubscriptionData);
    case "subscription.active":
      return handleSubscriptionActive(data as CreemSubscriptionData);
    case "subscription.scheduled_cancel":
      return handleSubscriptionScheduledCancel(data as CreemSubscriptionData);
    case "subscription.canceled":
    case "subscription.cancelled":
      return handleSubscriptionCanceled(data as CreemSubscriptionData);
    case "subscription.expired":
      return handleSubscriptionExpired(data as CreemSubscriptionData);
    default:
      console.log(`[Creem Webhook] Ignored event type: ${eventType}`);
      return { status: "ignored", eventType };
  }
}

async function handleCheckoutCompleted(data: CreemCheckoutData) {
  const objectData = data.object || {};
  const requestId = assertNonEmptyString(
    objectData.request_id || data.requestId,
    "requestId",
    {
      action: "checkout_completed",
      topLevelKeys: Object.keys(data),
      objectKeys: Object.keys(objectData),
    }
  );
  const metadata = objectData.metadata || data.metadata || {};
  const subscription = objectData.subscription;
  const metadataKeys = Object.keys(metadata);

  const order = await OrderService.handlePaymentSuccess(requestId);
  if (!order) {
    throw new CreemWebhookError(
      "ORDER_NOT_FOUND",
      "Order not found for webhook requestId",
      500,
      {
        action: "checkout_completed",
        requestId,
      }
    );
  }

  const productType = (metadata.product_type as string) || "one_time";
  const userId = assertNonEmptyString(metadata.user_id, "metadata.user_id", {
    action: "checkout_completed",
    requestId,
    metadataKeys,
  });

  logWebhook("info", "Processing checkout.completed", {
    requestId,
    orderId: order.id,
    productType,
    userId,
    metadataKeys,
    hasSubscriptionObject: Boolean(subscription),
  });

  if (productType === "one_time") {
    const credits = parseInt((metadata.credits as string) || "0", 10);
    const bonusCredits = parseInt(
      (metadata.bonus_credits as string) || "0",
      10
    );

    await CreditService.grantCredits({
      userId,
      amount: credits + bonusCredits,
      source: "one_time",
      type: "purchase",
      orderId: order.id,
      description: `Purchased ${credits} credits${
        bonusCredits > 0 ? ` + ${bonusCredits} bonus` : ""
      }`,
      metadata: {
        request_id: requestId,
        order_id: order.id,
        provider: "creem",
      },
      idempotencyKey: `order:${order.id}`,
    });
  } else if (productType === "subscription") {
    const subscriptionId =
      subscription?.id ||
      objectData.subscription_id ||
      (metadata.subscription_id as string) ||
      requestId;
    const planId = (metadata.plan_id as string) || order.productId;
    let planName = order.productName;
    let creditsPerPeriod = parseInt(
      (metadata.credits_per_period as string) || "0",
      10
    );
    let interval = ((metadata.subscription_interval as string) ||
      "month") as "month" | "year";

    const product = planId
      ? (getProductById(planId) as SubscriptionProduct | null)
      : null;
    if (product && product.type === "subscription") {
      creditsPerPeriod = product.creditsPerPeriod;
      interval = product.interval;
      planName = product.name;
    }

    const subscriptionPayload = (subscription ?? {}) as Record<string, unknown>;
    const { periodStart: providerPeriodStart, periodEnd: providerPeriodEnd } =
      resolveCreemPeriod(subscriptionPayload, metadata);
    const currentPeriodStart = providerPeriodStart ?? new Date();
    const currentPeriodEnd = providerPeriodEnd ?? new Date(currentPeriodStart);
    const periodSource =
      providerPeriodStart && providerPeriodEnd ? "provider" : "fallback";

    if (periodSource === "fallback") {
      if (interval === "month") {
        currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
      } else {
        currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
      }
    }

    logWebhook("info", "Creating subscription from checkout", {
      subscriptionId,
      planId,
      interval,
      currentPeriodStart: currentPeriodStart.toISOString(),
      currentPeriodEnd: currentPeriodEnd.toISOString(),
      periodSource,
    });

    await SubscriptionService.createSubscription({
      userId,
      planId,
      planName,
      provider: "creem",
      providerSubscriptionId: subscriptionId,
      interval,
      creditsPerPeriod,
      currentPeriodStart,
      currentPeriodEnd,
    });
  } else {
    throw new CreemWebhookError(
      "UNSUPPORTED_PRODUCT_TYPE",
      `Unsupported product type: ${productType}`,
      400,
      {
        action: "checkout_completed",
        requestId,
        productType,
      }
    );
  }

  const locale = (metadata.locale as string) || "en";
  const redirectUrl =
    productType === "subscription"
      ? `/${locale}/membership?new_subscription=true`
      : `/${locale}/home?payment=success&type=one_time&credits=${
          metadata.credits || 0
        }`;

  return {
    status: "success",
    action: "checkout_completed",
    orderId: order.id,
    orderNumber: order.orderNumber,
    requestId,
    productType,
    redirectUrl,
  };
}

async function handleCheckoutFailed(data: CreemCheckoutData) {
  const objectData = data.object || {};
  const requestId = assertNonEmptyString(
    objectData.request_id || data.requestId,
    "requestId",
    {
      action: "checkout_failed",
      topLevelKeys: Object.keys(data),
      objectKeys: Object.keys(objectData),
    }
  );

  const order = await OrderService.handlePaymentFailed(requestId);
  if (!order) {
    throw new CreemWebhookError(
      "ORDER_NOT_FOUND",
      "Order not found for failed checkout webhook",
      500,
      {
        action: "checkout_failed",
        requestId,
      }
    );
  }

  return {
    status: "failed",
    action: "checkout_failed",
    orderId: order.id,
    orderNumber: order.orderNumber,
    requestId,
    redirectUrl: "/payment/failed",
  };
}

async function handleSubscriptionActive(data: CreemSubscriptionData) {
  const { subscriptionId, subscription, customer, product, metadata, debug } =
    resolveCreemSubscriptionPayload(data);
  const { periodStart, periodEnd } = resolveCreemPeriod(subscription, metadata);

  logWebhook("info", "Resolved subscription.active payload", {
    subscriptionId,
    hasCustomerEmail: Boolean(customer?.email),
    productId: product?.id,
    hasPeriodStart: Boolean(periodStart),
    hasPeriodEnd: Boolean(periodEnd),
    debug,
  });

  if (!subscriptionId) {
    throw new CreemWebhookError(
      "MISSING_SUBSCRIPTION_ID",
      "Unable to resolve subscriptionId from subscription.active payload",
      400,
      {
        action: "subscription_active",
        debug,
      }
    );
  }

  const existingSubscription = await findSubscriptionWithShortRetry(subscriptionId);

  if (!existingSubscription) {
    throw new CreemWebhookError(
      "SUBSCRIPTION_NOT_FOUND",
      "subscription.active arrived before local subscription was created",
      500,
      {
        action: "subscription_active",
        subscriptionId,
        lookupAttempts: SUBSCRIPTION_LOOKUP_RETRY_DELAYS_MS.length + 1,
        lookupWaitMs: SUBSCRIPTION_LOOKUP_RETRY_DELAYS_MS.reduce((total, delay) => total + delay, 0),
        debug,
      }
    );
  }

  const isNewBillingPeriod = Boolean(
    periodStart &&
      periodEnd &&
      (periodStart.getTime() > existingSubscription.currentPeriodStart.getTime() ||
        periodEnd.getTime() > existingSubscription.currentPeriodEnd.getTime())
  );

  if (isNewBillingPeriod && periodStart && periodEnd) {
    logWebhook("warn", "subscription.active indicates a new billing period", {
      subscriptionId,
      currentPeriodStart: periodStart.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
    });
    await SubscriptionService.renewSubscription({
      providerSubscriptionId: subscriptionId,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    });
  } else if (periodStart && periodEnd) {
    await SubscriptionService.syncSubscriptionPeriod(
      subscriptionId,
      periodStart,
      periodEnd
    );
  } else {
    await SubscriptionService.updateSubscriptionStatus(
      subscriptionId,
      SUBSCRIPTION_STATUS.ACTIVE
    );
  }

  logWebhook("info", "subscription.active handled", {
    subscriptionId,
    interval: existingSubscription.interval,
    isNewBillingPeriod,
    currentPeriodStart: periodStart?.toISOString() ?? null,
    currentPeriodEnd: periodEnd?.toISOString() ?? null,
  });

  return {
    status: "success",
    action: "subscription_active",
    subscriptionId,
  };
}

async function handleSubscriptionPaid(data: CreemSubscriptionData) {
  const { subscriptionId, subscription, customer, product, metadata, debug } =
    resolveCreemSubscriptionPayload(data);
  const { periodStart, periodEnd } = resolveCreemPeriod(subscription, metadata);

  logWebhook("info", "Resolved subscription.paid payload", {
    subscriptionId,
    hasCustomerEmail: Boolean(customer?.email),
    productId: product?.id,
    hasPeriodStart: Boolean(periodStart),
    hasPeriodEnd: Boolean(periodEnd),
    debug,
  });

  if (!subscriptionId) {
    throw new CreemWebhookError(
      "MISSING_SUBSCRIPTION_ID",
      "Unable to resolve subscriptionId from subscription.paid payload",
      400,
      {
        action: "subscription_paid",
        debug,
      }
    );
  }

  const existingSubscription = await findSubscriptionWithShortRetry(subscriptionId);

  if (!existingSubscription) {
    throw new CreemWebhookError(
      "SUBSCRIPTION_NOT_FOUND",
      "subscription.paid arrived before local subscription was created",
      500,
      {
        action: "subscription_paid",
        subscriptionId,
        lookupAttempts: SUBSCRIPTION_LOOKUP_RETRY_DELAYS_MS.length + 1,
        lookupWaitMs: SUBSCRIPTION_LOOKUP_RETRY_DELAYS_MS.reduce((total, delay) => total + delay, 0),
        debug,
      }
    );
  }

  const isNewBillingPeriod = Boolean(
    periodStart &&
      periodEnd &&
      (periodStart.getTime() > existingSubscription.currentPeriodStart.getTime() ||
        periodEnd.getTime() > existingSubscription.currentPeriodEnd.getTime())
  );

  if (isNewBillingPeriod && periodStart && periodEnd) {
    await SubscriptionService.renewSubscription({
      providerSubscriptionId: subscriptionId,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    });
  } else if (periodStart && periodEnd) {
    await SubscriptionService.syncSubscriptionPeriod(
      subscriptionId,
      periodStart,
      periodEnd
    );
  } else {
    await SubscriptionService.updateSubscriptionStatus(
      subscriptionId,
      SUBSCRIPTION_STATUS.ACTIVE
    );
  }

  logWebhook("info", "subscription.paid handled", {
    subscriptionId,
    hasCustomerEmail: Boolean(customer?.email),
    productId: product?.id,
    isNewBillingPeriod,
    currentPeriodStart: periodStart?.toISOString() ?? null,
    currentPeriodEnd: periodEnd?.toISOString() ?? null,
  });

  return {
    status: "success",
    action: "subscription_paid",
    subscriptionId,
  };
}

async function handleSubscriptionScheduledCancel(data: CreemSubscriptionData) {
  const { subscriptionId, subscription, customer, metadata, debug } =
    resolveCreemSubscriptionPayload(data);
  const cancelAt = parseCreemDate(
    subscription.cancel_at ??
      subscription.cancel_at_date ??
      (metadata?.cancel_at as unknown) ??
      (metadata?.cancel_at_date as unknown)
  );

  assertNonEmptyString(subscriptionId, "subscriptionId", {
    action: "subscription_scheduled_cancel",
    debug,
  });

  await SubscriptionService.syncCancellationFromWebhook({
    providerSubscriptionId: subscriptionId,
    cancelAtPeriodEnd: true,
    cancelAt,
  });

  logWebhook("info", "subscription.scheduled_cancel handled", {
    subscriptionId,
    hasCustomerEmail: Boolean(customer?.email),
    cancelAt: cancelAt?.toISOString() ?? null,
  });

  return {
    status: "success",
    action: "subscription_scheduled_cancel",
    subscriptionId,
  };
}

async function handleSubscriptionCanceled(data: CreemSubscriptionData) {
  const { subscriptionId, subscription, customer, metadata, debug } =
    resolveCreemSubscriptionPayload(data);
  const cancelAt = parseCreemDate(
    subscription.cancel_at ??
      subscription.cancel_at_date ??
      (metadata?.cancel_at as unknown) ??
      (metadata?.cancel_at_date as unknown)
  );

  assertNonEmptyString(subscriptionId, "subscriptionId", {
    action: "subscription_canceled",
    debug,
  });

  await SubscriptionService.syncCancellationFromWebhook({
    providerSubscriptionId: subscriptionId,
    cancelAtPeriodEnd: false,
    cancelAt,
  });

  logWebhook("info", "subscription.canceled handled", {
    subscriptionId,
    hasCustomerEmail: Boolean(customer?.email),
    cancelAt: cancelAt?.toISOString() ?? null,
  });

  return {
    status: "success",
    action: "subscription_canceled",
    subscriptionId,
  };
}

async function handleSubscriptionExpired(data: CreemSubscriptionData) {
  const { subscriptionId, debug } = resolveCreemSubscriptionPayload(data);

  assertNonEmptyString(subscriptionId, "subscriptionId", {
    action: "subscription_expired",
    debug,
  });

  await SubscriptionService.updateSubscriptionStatus(
    subscriptionId,
    SUBSCRIPTION_STATUS.EXPIRED
  );

  return {
    status: "expired",
    action: "subscription_expired",
    subscriptionId,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get("locale") || "en";

  return NextResponse.json({
    message: "Creem callback endpoint is working",
    locale,
    timestamp: new Date().toISOString(),
  });
}
