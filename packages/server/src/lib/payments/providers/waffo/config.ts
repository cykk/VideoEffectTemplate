import { getEnv } from '@markless/shared/src/lib/config/env'

export type WaffoMode = 'test' | 'prod'
export function getWaffoMode(): WaffoMode {
  const value = getEnv('WAFFO_ENV', 'test')
  if (value !== 'test' && value !== 'production') throw new Error('WAFFO_ENV must be test or production')
  return value === 'production' ? 'prod' : 'test'
}
export function getWaffoSettings() {
  return {
    mode: getWaffoMode(), merchantId: getEnv('WAFFO_MERCHANT_ID'), privateKey: getEnv('WAFFO_PRIVATE_KEY'),
    publicKey: getEnv('WAFFO_WEBHOOK_PUBLIC_KEY'), storeId: getEnv('WAFFO_STORE_ID'),
    taxCategory: getEnv('WAFFO_TAX_CATEGORY', 'digital_goods') || 'digital_goods',
  }
}
export function getWaffoProduct(productId: string, type: 'one_time' | 'subscription', tier?: string) {
  const raw = getEnv(type === 'subscription' ? 'WAFFO_SUBSCRIPTIONS' : 'WAFFO_PACKS', '{}')
  const mapping = JSON.parse(raw || '{}') as Record<string, string>
  const id = mapping[`${productId}:${tier}`] || mapping[productId]
  if (typeof id !== 'string' || !/^PROD_[A-Za-z0-9]+$/.test(id)) throw new Error('app.payments.checkout.error.unavailable')
  return id
}
export function assertWaffoCheckoutReady() {
  const settings = getWaffoSettings()
  if (getEnv('WAFFO_ENABLED') !== 'true' || getEnv('WAFFO_OPERATIONS_ENABLED') !== 'true' || !settings.merchantId || !settings.privateKey || !settings.publicKey || !settings.storeId) {
    throw new Error('app.payments.checkout.error.unavailable')
  }
  return settings
}
