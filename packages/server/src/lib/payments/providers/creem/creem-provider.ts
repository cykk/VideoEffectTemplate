import type { IPaymentProvider } from '../../core/payment-provider.interface'
import type { CheckoutParams, CheckoutResult, WebhookResult } from '../../core/payment-types'
import { getPaymentSuccessBaseUrl } from '@markless/shared/src/lib/config/urls'
import { getEnv } from '@markless/shared/src/lib/config/env'
import { defaultLocale } from '@markless/shared/src/i18n/types'
import { newCreemClient } from '@markless/server/src/lib/payments/creem'

/**
 * Creem 支付提供商
 * 支持一次性支付和订阅两种模式
 */
export class CreemProvider implements IPaymentProvider {
  readonly name = 'creem'
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
    this.apiKey = config.apiKey || getEnv('CREEM_API_KEY') || ''
    this.webhookSecret = config.webhookSecret
    this.env = config.env || 'test'

    if (this.enabled && !this.apiKey) {
      throw new Error('Creem API key is required when enabled')
    }
  }

  async createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    // 获取产品映射
    const products = this.getProductMapping(params.productType)

    // 对于充值包，根据用户等级选择对应的产品ID
    let mappingKey = params.productId
    let providerProductId = products[mappingKey]

    if (!providerProductId && params.productType === 'one_time' && params.userPricingTier) {
      const tierKey = `${params.productId}:${params.userPricingTier}`
      providerProductId = products[tierKey]
      if (providerProductId) {
        mappingKey = tierKey
      }
    }

    if (!providerProductId) {
      throw new Error(`Creem product mapping not found for: ${mappingKey}`)
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

    // 构建metadata
    const metadata: Record<string, unknown> = {
      locale: params.locale,
      order_id: params.orderId,
      order_number: params.orderNumber,
      user_id: params.userId,
      product_type: params.productType,
      ...(params.metadata || {}),
    }

    // 订阅模式：添加订阅相关信息
    if (params.productType === 'subscription') {
      metadata.plan_id = params.productId  // 添加 planId
      metadata.subscription_interval = params.interval
      metadata.credits_per_period = params.creditsPerPeriod
    }

    // 充值模式：添加积分信息
    if (params.productType === 'one_time') {
      metadata.credits = params.credits
      metadata.bonus_credits = params.bonusCredits || 0
    }

    const creemClient = newCreemClient({
      apiKey: this.apiKey,
      env: this.env,
    })

    const payload = await creemClient.createCheckout({
      productId: providerProductId,
      requestId: params.requestId,
      customerEmail: params.customerEmail,
      successUrl: successUrl.toString(),
      metadata,
    })

    if (!payload.checkout_url || !payload.id) {
      throw new Error("Creem checkout response invalid")
    }

    return {
      provider: this.name,
      requestId: params.requestId,
      sessionId: payload.id,
      checkoutUrl: payload.checkout_url,
      orderId: params.orderId,
    }
  }

  async handleWebhook(_payload: unknown, _signature?: string): Promise<WebhookResult> {
    // Webhook处理逻辑在路由中实现
    // 这里抛出错误提示使用正确的路由
    throw new Error('Use /api/pay/callback/creem route for webhook handling')
  }

  /**
   * 获取产品映射
   * 根据产品类型选择不同的环境变量
   */
  private getProductMapping(productType: 'subscription' | 'one_time'): Record<string, string> {
    let envProducts: string | undefined

    if (productType === 'subscription') {
      envProducts = getEnv('CREEM_SUBSCRIPTIONS')
    } else {
      envProducts = getEnv('CREEM_PACKS')
    }

    if (!envProducts) return {}

    try {
      return JSON.parse(envProducts)
    } catch (error) {
      console.error('Failed to parse Creem products:', error)
      return {}
    }
  }
}
