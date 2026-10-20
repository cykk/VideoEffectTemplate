import { NextRequest, NextResponse } from "next/server"
import { OrderService } from "@markless/server/src/lib/orders/service"
import { CreditService } from "@markless/server/src/lib/credits/service"
import { SubscriptionService } from "@markless/server/src/lib/subscriptions/service"
import { newStripeClient } from "@markless/server/src/lib/payments/providers/stripe/stripe-client"
import type Stripe from "stripe"
import { getProductById, type SubscriptionProduct } from "@markless/shared/src/lib/products/config"
import { SUBSCRIPTION_STATUS } from "@markless/shared/src/constants/subscription"
import { getEnv } from "@markless/shared/src/lib/config/env"

/**
 * Stripe Webhook 处理
 * 支持订阅和一次性支付的事件
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.text()
    const signature = request.headers.get("stripe-signature")

    if (!signature) {
      return NextResponse.json({ error: "缺少签名" }, { status: 400 })
    }

    // 验证 webhook 签名
    const webhookSecret = getEnv("STRIPE_WEBHOOK_SECRET")
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET not configured")
    }

    const client = newStripeClient()
    const stripe = client.stripe()

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
    } catch (err) {
      console.error("[Stripe Webhook] Signature verification failed:", err)
      return NextResponse.json({ error: "签名验证失败" }, { status: 400 })
    }

    console.log("[Stripe Webhook] Event received:", {
      type: event.type,
      id: event.id,
    })

    // 处理事件
    const result = await handleStripeEvent(event)

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error("[Stripe Webhook] Error:", error)
    return NextResponse.json(
      {
        error: "服务器内部错误",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * 处理 Stripe 事件
 */
async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    // ===== 一次性支付完成 =====
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session

      if (session.mode === "payment") {
        // 一次性充值
        return await handleOneTimePayment(session)
      }

      if (session.mode === "subscription") {
        // 订阅创建
        return await handleSubscriptionCreated(session)
      }

      break
    }

    // ===== 订阅续费成功 =====
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice

      // 仅处理订阅续费（不包括首次支付）
      if (invoice.billing_reason === "subscription_cycle") {
        return await handleSubscriptionRenewal(invoice)
      }

      break
    }

    // ===== 订阅取消 =====
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription
      return await handleSubscriptionCancelled(subscription)
    }

    // ===== 订阅更新 =====
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription
      return await handleSubscriptionUpdated(subscription)
    }

    // ===== 支付失败 =====
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session
      return await handlePaymentFailed(session)
    }

    default:
      console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
      return { status: "ignored", eventType: event.type }
  }
}

/**
 * 处理一次性支付成功
 */
async function handleOneTimePayment(session: Stripe.Checkout.Session) {
  const requestId = session.client_reference_id

  console.log("[Stripe Webhook] Processing checkout.session.completed:", {
    requestId,
    sessionId: session.id,
    mode: session.mode,
  })

  if (!requestId) {
    console.error("[Stripe Webhook] No client_reference_id in session")
    return { status: "error", message: "No request ID" }
  }

  const credits = parseInt(session.metadata?.credits || "0")
  const bonusCredits = parseInt(session.metadata?.bonus_credits || "0")
  const userId = session.metadata?.user_id

  if (!userId) {
    console.error("[Stripe Webhook] No user_id in metadata")
    return { status: "error", message: "No user ID" }
  }

  // 更新订单状态
  const order = await OrderService.handlePaymentSuccess(requestId, session.id)

  if (!order) {
    return { status: "error", message: "Order not found" }
  }

  // 发放积分
  await CreditService.grantCredits({
    userId,
    amount: credits + bonusCredits,
    source: "one_time",
    type: "purchase",
    orderId: order.id,
    description: `Purchased ${credits} credits${bonusCredits > 0 ? ` + ${bonusCredits} bonus` : ""}`,
    metadata: {
      session_id: session.id,
      order_id: order.id,
    },
    idempotencyKey: `order:${order.id}`,
  })

  console.log("[Stripe Webhook] One-time payment succeeded:", {
    orderId: order.id,
    sessionId: session.id,
    credits: credits + bonusCredits,
  })

  return {
    status: "success",
    action: "one_time_payment",
    orderId: order.id,
  }
}

/**
 * 处理订阅创建
 */
async function handleSubscriptionCreated(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id
  const planId = session.metadata?.product_id || session.metadata?.plan_id
  let planName = session.metadata?.product_name || "Subscription Plan"
  let creditsPerPeriod = parseInt(session.metadata?.credits_per_period || "0")
  let interval = (session.metadata?.subscription_interval || "month") as "month" | "year"

  const product = planId ? (getProductById(planId) as SubscriptionProduct | null) : null
  if (product && product.type === "subscription") {
    if (creditsPerPeriod && creditsPerPeriod !== product.creditsPerPeriod) {
      console.warn("[Stripe Webhook] credits_per_period mismatch, using config:", {
        metadata: creditsPerPeriod,
        config: product.creditsPerPeriod,
        planId,
      })
    }
    if (interval && interval !== product.interval) {
      console.warn("[Stripe Webhook] subscription_interval mismatch, using config:", {
        metadata: interval,
        config: product.interval,
        planId,
      })
    }
    creditsPerPeriod = product.creditsPerPeriod
    interval = product.interval
    planName = product.name
  } else {
    console.warn("[Stripe Webhook] Subscription plan not found or invalid, falling back to metadata:", {
      planId,
      productType: product?.type,
    })
  }

  if (!userId || !planId || !creditsPerPeriod) {
    console.error("[Stripe Webhook] Missing subscription metadata")
    return { status: "error", message: "Missing subscription data" }
  }

  const subscriptionId = session.subscription as string

  if (!subscriptionId) {
    console.error("[Stripe Webhook] No subscription ID")
    return { status: "error", message: "No subscription ID" }
  }

  // 获取订阅详情
  const client = newStripeClient()
  const stripe = client.stripe()
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  // 创建订阅记录
  await SubscriptionService.createSubscription({
    userId,
    planId,
    planName,
    provider: "stripe",
    providerSubscriptionId: subscriptionId,
    providerCustomerId: subscription.customer as string,
    interval,
    creditsPerPeriod,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
  })

  // 更新订单状态
  const requestId = session.client_reference_id
  if (requestId) {
    await OrderService.handlePaymentSuccess(requestId, session.id)
  }

  console.log("[Stripe Webhook] Subscription created:", {
    subscriptionId,
    userId,
    planId,
    creditsPerPeriod,
  })

  return {
    status: "success",
    action: "subscription_created",
    subscriptionId,
  }
}

/**
 * 处理订阅续费
 */
async function handleSubscriptionRenewal(invoice: Stripe.Invoice) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subscriptionId = (invoice as any).subscription as string

  if (!subscriptionId) {
    return { status: "error", message: "No subscription ID" }
  }

  // 获取订阅详情
  const client = newStripeClient()
  const stripe = client.stripe()
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  // 续期订阅并发放积分
  await SubscriptionService.renewSubscription({
    providerSubscriptionId: subscriptionId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
  })

  console.log("[Stripe Webhook] Subscription renewed:", {
    subscriptionId,
    invoiceId: invoice.id,
  })

  return {
    status: "success",
    action: "subscription_renewed",
    subscriptionId,
  }
}

/**
 * 处理订阅取消
 */
async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
  const cancelAtPeriodEnd = subscription.cancel_at_period_end

  await SubscriptionService.cancelSubscription(subscription.id, cancelAtPeriodEnd)

  console.log("[Stripe Webhook] Subscription cancelled:", {
    subscriptionId: subscription.id,
    cancelAtPeriodEnd,
  })

  return {
    status: "success",
    action: "subscription_cancelled",
    subscriptionId: subscription.id,
  }
}

/**
 * 处理订阅更新
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  let normalizedStatus: "active" | "expired" | "past_due" | "paused" | null = null
  switch (subscription.status) {
    case "active":
    case "trialing":
      normalizedStatus = SUBSCRIPTION_STATUS.ACTIVE
      break
    case "past_due":
    case "unpaid":
      normalizedStatus = SUBSCRIPTION_STATUS.PAST_DUE
      break
    case "paused":
      normalizedStatus = SUBSCRIPTION_STATUS.PAUSED
      break
    case "canceled":
    case "incomplete_expired":
      normalizedStatus = SUBSCRIPTION_STATUS.EXPIRED
      break
    default:
      console.warn("[Stripe Webhook] Unmapped subscription status, ignoring:", {
        status: subscription.status,
        subscriptionId: subscription.id,
      })
      return {
        status: "ignored",
        action: "subscription_updated",
        subscriptionId: subscription.id,
      }
  }

  await SubscriptionService.updateSubscriptionStatus(subscription.id, normalizedStatus)

  console.log("[Stripe Webhook] Subscription updated:", {
    subscriptionId: subscription.id,
    status: normalizedStatus,
  })

  return {
    status: "success",
    action: "subscription_updated",
    subscriptionId: subscription.id,
  }
}

/**
 * 处理支付失败
 */
async function handlePaymentFailed(session: Stripe.Checkout.Session) {
  const requestId = session.client_reference_id

  if (requestId) {
    await OrderService.handlePaymentFailed(requestId)
  }

  return { status: "failed", action: session.mode === "payment" ? "payment_failed" : "subscription_failed" }
}

/**
 * 测试端点
 */
export async function GET() {
  return NextResponse.json({
    message: "Stripe callback endpoint is working",
    timestamp: new Date().toISOString(),
  })
}
