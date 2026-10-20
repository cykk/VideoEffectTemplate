import type { IPaymentProvider } from './core/payment-provider.interface'
import type { CheckoutParams, CheckoutResult } from './core/payment-types'
import { getPaymentConfig } from './core/payment-config'
import { CreemProvider } from './providers/creem/creem-provider'
import { StripeProvider } from './providers/stripe/stripe-provider'
import { resolveCheckoutProvider } from './routing'
import { WaffoProvider } from './providers/waffo/waffo-provider'

/** Payment provider registry. Checkout always uses the explicitly configured provider. */
export class PaymentService {
  private readonly providers = new Map<string, IPaymentProvider>()
  private readonly config = getPaymentConfig()

  constructor() {
    try { this.providers.set('creem', new CreemProvider(this.config.providers.creem)) } catch (error) { console.error('[PaymentService] Creem init failed:', error) }
    try { this.providers.set('stripe', new StripeProvider(this.config.providers.stripe)) } catch (error) { console.error('[PaymentService] Stripe init failed:', error) }
    try { this.providers.set('waffo', new WaffoProvider({ enabled: this.config.providers.waffo.enabled, ...this.config.waffo })) } catch (error) { console.error('[PaymentService] Waffo init failed:', error) }
  }

  async createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const selectedProvider = resolveCheckoutProvider(params.productType)
    const provider = this.providers.get(selectedProvider)
    if (!provider?.enabled) throw new Error(`Configured payment provider is unavailable: ${selectedProvider}`)
    return provider.createCheckout(params)
  }

  getProvider(name: string): IPaymentProvider | undefined { return this.providers.get(name) }

  getEnabledProviderNames(): string[] {
    return Array.from(this.providers.values()).filter((provider) => provider.enabled).map((provider) => provider.name)
  }

  getConfig() {
    return { enabledProviders: this.getEnabledProviderNames(), activeProvider: this.config.activeProvider, fallbackEnabled: false, strategy: 'explicit' as const }
  }
}

let paymentServiceInstance: PaymentService | null = null
export function getPaymentService(): PaymentService {
  if (!paymentServiceInstance) paymentServiceInstance = new PaymentService()
  return paymentServiceInstance
}
