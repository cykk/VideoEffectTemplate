import type { IPaymentProvider } from '../../core/payment-provider.interface'
import type { CheckoutParams, CheckoutResult, WebhookResult } from '../../core/payment-types'
import { getPaymentSuccessBaseUrl } from '@markless/shared/src/lib/config/urls'
import { assertWaffoCheckoutReady, getWaffoProduct } from './config'
import { waffoRequest } from './client'

export class WaffoProvider implements IPaymentProvider {
  readonly name = 'waffo'
  readonly enabled: boolean
  constructor(config: { enabled: boolean }) { this.enabled = config.enabled }

  async createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const config = assertWaffoCheckoutReady()
    const productId = getWaffoProduct(params.productId, params.productType, params.userPricingTier)
    const successUrl = new URL(params.returnTo || '/dashboard', getPaymentSuccessBaseUrl())
    if (successUrl.protocol !== 'https:') throw new Error('app.payments.checkout.error.unavailable')
    successUrl.searchParams.set('order_id', params.orderId)
    successUrl.searchParams.set('request_id', params.requestId)
    successUrl.searchParams.set('type', params.productType)
    successUrl.searchParams.set('payment', 'success')
    successUrl.searchParams.set('payment_type', params.productType === 'one_time' ? 'credits' : 'subscription')
    successUrl.searchParams.set('payment_request_id', params.requestId)
    const session = await waffoRequest<{ sessionId: string; checkoutUrl: string; expiresAt: string }>('/v1/actions/checkout/create-session', {
      productId, currency: params.currency.toUpperCase(),
      priceSnapshot: { amount: Number(params.amount).toFixed(2), taxIncluded: false, taxCategory: config.taxCategory },
      buyerEmail: params.customerEmail, successUrl: successUrl.toString(),
      withTrial: false, expiresInSeconds: 1800, language: 'en', orderMerchantExternalId: params.orderId,
      metadata: { orderId: params.orderId, userId: params.userId, productId: params.productId, requestId: params.requestId },
    })
    if (!session.sessionId || !session.checkoutUrl || new URL(session.checkoutUrl).protocol !== 'https:') throw new Error('app.payments.checkout.error.provider')
    return { provider: this.name, requestId: params.requestId, sessionId: session.sessionId, checkoutUrl: session.checkoutUrl, orderId: params.orderId, expiresAt: new Date(session.expiresAt) }
  }
  async handleWebhook(): Promise<WebhookResult> { throw new Error('Use the dedicated Waffo callback route') }
}
