import type { IPaymentProvider } from '../../core/payment-provider.interface'
import type { CheckoutParams, CheckoutResult, WebhookResult } from '../../core/payment-types'
import { newStripeClient } from './stripe-client'
import { getPaymentSuccessBaseUrl } from '@markless/shared/src/lib/config/urls'
import { getEnv } from '@markless/shared/src/lib/config/env'
import { defaultLocale } from '@markless/shared/src/i18n/types'

/**
 * Stripe 支付提供商
 * 支持一次性支付和订阅两种模式
 */
export class StripeProvider implements IPaymentProvider {
  readonly name = 'stripe'
  readonly enabled: boolean

  private apiKey: string
  private webhookSecret?: string
  private env: 'test' | 'production'

  constructor(config: {
    enabled: boolean
    apiKey?: string
    webhookSecret?: string
    env?: 'test' | 'production'
  }) {
    this.enabled = config.enabled
    this.apiKey = config.apiKey || getEnv('STRIPE_SECRET_KEY') || ''
    this.webhookSecret = config.webhookSecret
    this.env = config.env || 'test'

    if (this.enabled && !this.apiKey) {
      throw new Error('Stripe API key is required when enabled')
    }
  }

  async createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const client = newStripeClient({ apiKey: this.apiKey, env: this.env })
    const stripe = client.stripe()

    // 根据产品类型选择mode和获取Price ID
    const mode = params.productType === 'subscription' ? 'subscription' : 'payment'
    const priceId = this.getPriceId(params.productId, params.productType)

    if (!priceId) {
      throw new Error(`Stripe price mapping not found for: ${params.productId}`)
    }

    const baseUrl = getPaymentSuccessBaseUrl()
    const locale = params.locale || defaultLocale
    const localePrefix = locale === defaultLocale ? "" : `/${locale}`
    const shouldReturnToTool = params.productType === "one_time" && !!params.returnTo
    const successUrl = shouldReturnToTool
      ? new URL(`${baseUrl}${params.returnTo}`)
      : new URL(`${baseUrl}${localePrefix}/dashboard`)

    if (shouldReturnToTool) {
      successUrl.searchParams.set("payment", "success")
      successUrl.searchParams.set("payment_type", "credits")
      successUrl.searchParams.set("payment_request_id", params.requestId)
    } else {
      successUrl.searchParams.set("request_id", params.requestId)
      successUrl.searchParams.set("order_id", params.orderId)
      successUrl.searchParams.set("type", params.productType)
      if (params.returnTo) {
        successUrl.searchParams.set("return_to", params.returnTo)
      }
    }
    const cancelUrl = `${baseUrl}${localePrefix}/payment/failed`

    // 构建metadata
    const metadata: Record<string, string> = {
      order_id: params.orderId,
      order_number: params.orderNumber,
      user_id: params.userId,
      locale,
      product_name: params.productName,
      product_type: params.productType,
    }

    // 订阅模式：添加订阅相关信息
    if (params.productType === 'subscription' && params.creditsPerPeriod) {
      metadata.subscription_interval = params.interval || 'month'
      metadata.credits_per_period = params.creditsPerPeriod.toString()
    }

    // 充值模式：添加积分信息
    if (params.productType === 'one_time') {
      if (params.credits) metadata.credits = params.credits.toString()
      if (params.bonusCredits) metadata.bonus_credits = params.bonusCredits.toString()
    }

    // 添加自定义metadata
    if (params.metadata) {
      Object.entries(params.metadata).forEach(([key, value]) => {
        metadata[key] = String(value)
      })
    }

    // 创建Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: params.customerEmail,
      client_reference_id: params.requestId,  // 用于关联订单
      success_url: successUrl.toString(),
      cancel_url: cancelUrl,
      metadata,
    })

    return {
      provider: this.name,
      requestId: params.requestId,
      sessionId: session.id,
      checkoutUrl: session.url!,
      orderId: params.orderId,
      expiresAt: new Date(session.expires_at * 1000),
    }
  }

  async handleWebhook(_payload: unknown, _signature?: string): Promise<WebhookResult> {
    // Webhook处理逻辑在路由中实现
    throw new Error('Use /api/pay/callback/stripe route for webhook handling')
  }

  /**
   * 获取Stripe Price ID
   * 根据产品类型选择不同的环境变量
   */
  private getPriceId(productId: string, productType: 'subscription' | 'one_time'): string | null {
    let envPrices: string | undefined

    if (productType === 'subscription') {
      // 订阅产品：优先使用STRIPE_SUBSCRIPTION_PRICES，回退到STRIPE_PRICES
      envPrices = getEnv('STRIPE_SUBSCRIPTION_PRICES') || getEnv('STRIPE_PRICES')
    } else {
      // 一次性产品：使用STRIPE_PRICES
      envPrices = getEnv('STRIPE_PRICES')
    }

    if (!envPrices) return null

    try {
      const prices = JSON.parse(envPrices)
      return prices[productId] || null
    } catch (error) {
      console.error('Failed to parse Stripe prices:', error)
      return null
    }
  }
}
