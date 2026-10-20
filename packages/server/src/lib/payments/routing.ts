import { getEnv } from '@markless/shared/src/lib/config/env'

export type CheckoutProvider = 'creem' | 'waffo'
export function resolveCheckoutProvider(type: 'one_time' | 'subscription'): CheckoutProvider {
  const override = getEnv(type === 'one_time' ? 'PAYMENT_ONE_TIME_PROVIDER' : 'PAYMENT_SUBSCRIPTION_PROVIDER')
  const provider = (override || getEnv('PAYMENT_PROVIDER', 'creem') || 'creem').toLowerCase()
  if (provider !== 'creem' && provider !== 'waffo') throw new Error('app.payments.checkout.error.unavailable')
  return provider
}
