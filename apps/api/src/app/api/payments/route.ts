import { NextRequest, NextResponse } from "next/server"
import { nanoid } from "nanoid"
import { auth } from "@markless/server/src/lib/auth/server"
import { getEnv } from "@markless/shared/src/lib/config/env"
import { OrderService } from "@markless/server/src/lib/orders/service"
import { getPaymentService } from "@markless/server/src/lib/payments/payment-service"
import {
  getProductById,
  getProductPrice,
  getUserPricingTier,
  type UserPricingTier
} from "@markless/shared/src/lib/products/config"
import { db } from "@markless/server/src/lib/db/client"
import { userSubscriptions } from "@markless/server/src/lib/db/schema"
import { and, eq, inArray } from "drizzle-orm"
import { SUBSCRIPTION_STATUS } from "@markless/shared/src/constants/subscription"
import type { CheckoutResult } from "@markless/shared/src/lib/payments/core/payment-types"
import { resolveCheckoutProvider } from "@markless/server/src/lib/payments/routing"
import { createWaffoOrder } from "@markless/server/src/lib/payments/providers/waffo/checkout"
import { getWaffoProduct } from "@markless/server/src/lib/payments/providers/waffo/config"
import { orders } from "@markless/server/src/lib/db/schema/orders"
import { waffoOrders } from "@markless/server/src/lib/db/schema/waffo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function respErr(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status })
}

function respData<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status })
}

/**
 * 创建支付会话
 * 支持订阅和一次性充值两种模式
 */
export async function POST(req: NextRequest) {
  try {
    const {
      product_id,
      locale,
      return_to,
    }: {
      product_id?: string
      locale?: string
      return_to?: string
    } = await req.json()

    const safeReturnTo =
      return_to &&
      return_to.startsWith('/') &&
      !return_to.startsWith('//') &&
      !return_to.includes('://')
        ? return_to
        : undefined

    if (!product_id) {
      return respErr("invalid params: product_id")
    }

    // 从产品配置中获取产品信息
    const product = getProductById(product_id)
    if (!product || !product.isActive) {
      return respErr("invalid product_id")
    }

    // 验证用户登录
    const session = await auth.api.getSession({ headers: req.headers })
    const userEmail = session?.user?.email
    const userId = session?.user?.id
    if (!userEmail || !userId) {
      return respErr("no auth, please sign-in", 401)
    }

    // 获取用户当前订阅等级（用于差异化定价）
    let userPricingTier: UserPricingTier = 'free'

    if (product.type === 'one_time') {
      // 只有充值包需要差异化定价
      const activeSubscriptions = await db
        .select()
        .from(userSubscriptions)
        .where(
          and(
            eq(userSubscriptions.userId, userId),
            eq(userSubscriptions.status, SUBSCRIPTION_STATUS.ACTIVE) // 取消到期仍保持 active
          )
        )
        .limit(1)

      if (activeSubscriptions.length > 0) {
        userPricingTier = getUserPricingTier(activeSubscriptions[0].planId)
      }
    }

    // 根据用户等级获取正确的价格
    const actualPrice = getProductPrice(product.id, userPricingTier)

    console.log("[Payments API] Pricing info:", {
      productId: product.id,
      productType: product.type,
      userPricingTier,
      basePrice: product.price,
      actualPrice,
      discount: product.type === 'one_time' ? `${Math.round((1 - actualPrice / product.price) * 100)}%` : 'N/A'
    })

    const requestId = nanoid()
    const orderDraft = OrderService.createOrderDraft()

    // 使用支付服务创建支付会话（自动降级）
    const paymentService = getPaymentService()
    const activeProvider = resolveCheckoutProvider(product.type)
    if (activeProvider === 'waffo') getWaffoProduct(product.id, product.type, userPricingTier)
    if (activeProvider === 'creem' && product.type === 'subscription') {
      const [waffoSubscription] = await db.select().from(userSubscriptions).where(and(
        eq(userSubscriptions.userId, userId), eq(userSubscriptions.provider, 'waffo'), inArray(userSubscriptions.status, ['active', 'past_due', 'paused'])))
      const [waffoPending] = await db.select().from(orders).where(and(eq(orders.userId, userId), eq(orders.paymentProvider, 'waffo'),
        eq(orders.productType, 'subscription'), eq(orders.status, 'pending')))
      if (waffoSubscription || waffoPending) return respErr('app.payments.checkout.error.existingSubscription', 409)
    }

    // 构建支付参数（使用实际价格）
    const checkoutParams = {
      productId: product.id,
      productName: product.name,
      productType: product.type,
      amount: actualPrice.toString(),
      currency: product.currency,
      customerEmail: userEmail,
      userId,
      orderId: orderDraft.id,
      orderNumber: orderDraft.orderNumber,
      requestId,
      locale: locale || "en",
      returnTo: safeReturnTo,
      userPricingTier, // 传递用户定价等级
      metadata: {
        project: getEnv("NEXT_PUBLIC_PROJECT_NAME") || "",
        user_pricing_tier: userPricingTier,
      },
      // 订阅特有参数
      ...(product.type === "subscription" && {
        interval: product.interval,
        creditsPerPeriod: product.creditsPerPeriod,
      }),
      // 充值特有参数
      ...(product.type === "one_time" && {
        credits: product.credits,
        bonusCredits: product.bonusCredits,
      }),
    }

    const createOrder = activeProvider === 'waffo' ? createWaffoOrder : OrderService.createOrder.bind(OrderService)
    const order = await createOrder({
      id: orderDraft.id,
      userId,
      orderNumber: orderDraft.orderNumber,
      productId: product.id,
      productName: product.name,
      productType: product.type,
      amount: actualPrice.toString(),
      currency: product.currency,
      paymentProvider: activeProvider,
      paymentRequestId: requestId,
      customerEmail: userEmail,
      metadata: {
        project: getEnv("NEXT_PUBLIC_PROJECT_NAME") || "",
        product_type: product.type,
        user_pricing_tier: userPricingTier,
        base_price: product.price,
        actual_price: actualPrice,
        credits: product.type === 'one_time' ? product.credits : undefined,
        bonus_credits: product.type === 'one_time' ? product.bonusCredits : undefined,
        locale: locale || 'en',
        subscription_interval: product.type === 'subscription' ? product.interval : undefined,
        credits_per_period: product.type === 'subscription' ? product.creditsPerPeriod : undefined,
      },
    })

    let result: CheckoutResult
    try {
      result = await paymentService.createCheckout(checkoutParams)
      if (activeProvider === 'waffo') {
        await db.update(waffoOrders).set({ sessionId: result.sessionId, expiresAt: result.expiresAt, updatedAt: new Date() }).where(eq(waffoOrders.orderId, order.id))
        // Session attachment must never downgrade an already settled order.
        await db.update(orders)
          .set({ paymentSessionId: result.sessionId }).where(eq(orders.id, order.id))
      } else await OrderService.updateOrderStatus(order.id, 'pending', {
        paymentRequestId: result.requestId,
        paymentSessionId: result.sessionId,
      })
    } catch (error) {
      if (activeProvider === 'waffo') await db.update(waffoOrders).set({ reviewReason: 'checkout_response_unknown', updatedAt: new Date() }).where(eq(waffoOrders.orderId, order.id))
      throw error
    }

    console.log("[Payments API] Order created:", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      provider: order.paymentProvider,
      productId: product.id,
      productType: product.type,
      amount: actualPrice,
      requestId: result.requestId,
      userPricingTier,
    })

    console.log("[Payments API] Payment session created:", {
      provider: result.provider, // 实际使用的支付方式
      orderId: order.id,
      sessionId: result.sessionId,
      productType: product.type,
    })

    return respData({
      provider: result.provider,
      request_id: result.requestId,
      session_id: result.sessionId,
      checkout_url: result.checkoutUrl,
      order_id: order.id,
    })
  } catch (e: unknown) {
    console.error("[Payments API] Checkout failed:", e)
    const errorMessage = e instanceof Error ? e.message : String(e)
    return respErr(errorMessage.startsWith('app.payments.') ? errorMessage : 'app.payments.checkout.error.provider')
  }
}
