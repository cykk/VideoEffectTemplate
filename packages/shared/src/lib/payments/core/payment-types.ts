/**
 * 支付系统核心类型定义
 * 支持订阅和一次性充值两种模式
 */

export type ProductType = 'subscription' | 'one_time'

export type SubscriptionInterval = 'month' | 'year'

export interface CheckoutParams {
  productId: string
  productName: string
  productType: ProductType

  amount: string
  currency: string

  interval?: SubscriptionInterval
  creditsPerPeriod?: number

  credits?: number
  bonusCredits?: number

  customerEmail: string
  userId: string

  orderId: string
  orderNumber: string
  requestId: string

  locale?: string
  returnTo?: string
  userPricingTier?: 'free' | 'monthly_subscriber' | 'yearly_subscriber'
  metadata?: Record<string, unknown>
}

export interface CheckoutResult {
  provider: string
  requestId: string
  sessionId: string
  checkoutUrl: string
  orderId?: string
  expiresAt?: Date
}

export interface WebhookResult {
  provider: string
  status: 'success' | 'failed' | 'cancelled' | 'ignored'
  action: string
  orderId?: string
  orderNumber?: string
  requestId?: string
  subscriptionId?: string
  message?: string
  redirectUrl?: string
}

export interface ProviderConfig {
  enabled: boolean
  priority: number
  apiKey?: string
  webhookSecret?: string
  env?: 'test' | 'production'
}
