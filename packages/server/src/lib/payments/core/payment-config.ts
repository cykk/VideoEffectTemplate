import type { ProviderConfig } from './payment-types'
import { getEnv } from '@markless/shared/src/lib/config/env'

/** 支付配置 */
export interface PaymentConfig {
  activeProvider: 'creem' | 'waffo'
  /** 提供商配置 */
  providers: {
    creem: ProviderConfig
    waffo: ProviderConfig
    stripe: ProviderConfig
  }
  waffo: {
    merchantId?: string
    privateKey?: string
    webhookPublicKey?: string
    products: Record<string, string>
    taxCategory: string
  }

  /** 重试配置 */
  retry: {
    maxAttempts: number       // 最大尝试次数
    delay: number             // 重试延迟(ms)
  }

  /** 降级策略 */
  fallback: {
    enabled: boolean          // 是否启用自动降级
    strategy: 'priority' | 'round-robin'  // 降级策略
  }
}

/** 获取支付配置 */
export function getPaymentConfig(): PaymentConfig {
  const activeProvider = (getEnv('PAYMENT_PROVIDER', 'creem') || 'creem').toLowerCase()
  if (activeProvider !== 'creem' && activeProvider !== 'waffo') {
    throw new Error(`Unsupported PAYMENT_PROVIDER: ${activeProvider}`)
  }

  const waffoMerchantId = getEnv('WAFFO_MERCHANT_ID')
  const waffoPrivateKey = getEnv('WAFFO_PRIVATE_KEY')
  const waffoWebhookPublicKey = getEnv('WAFFO_WEBHOOK_PUBLIC_KEY')
  const waffoEnvironment = getEnv('WAFFO_ENV', 'test') || 'test'
  const waffoProducts = parseProductMap(getEnv('WAFFO_PACKS'))
  const waffoEnabled = getEnv('WAFFO_ENABLED') === 'true' && Boolean(waffoMerchantId && waffoPrivateKey)

  const stripeApiKey = getEnv('STRIPE_SECRET_KEY')
  const stripeEnabled =
    getEnv('STRIPE_ENABLED') === 'true' &&
    Boolean(stripeApiKey) &&
    !/your_stripe_secret_key/i.test(stripeApiKey || '')

  return {
    activeProvider,
    providers: {
      creem: {
        enabled: getEnv('CREEM_ENABLED') !== 'false',  // 默认启用
        priority: 1,  // 优先级1（最高）
        apiKey: getEnv('CREEM_API_KEY'),
        webhookSecret: getEnv('CREEM_WEBHOOK_SECRET'),
        env: (getEnv('CREEM_ENV') as 'test' | 'production') || 'test',
      },
      waffo: {
        enabled: waffoEnabled,
        priority: 2,
      },
      stripe: {
        enabled: stripeEnabled,  // 默认禁用，手动启用
        priority: 2,  // 优先级2
        apiKey: stripeApiKey,
        webhookSecret: getEnv('STRIPE_WEBHOOK_SECRET'),
        env: (getEnv('STRIPE_ENV') as 'test' | 'production') || 'test',
      },
    },
    waffo: {
      merchantId: waffoMerchantId,
      privateKey: waffoPrivateKey,
      webhookPublicKey: waffoWebhookPublicKey,
      products: waffoProducts,
      taxCategory: getEnv('WAFFO_TAX_CATEGORY', 'digital_goods') || 'digital_goods',
    },
    retry: {
      maxAttempts: Number(getEnv('PAYMENT_RETRY_MAX_ATTEMPTS')) || 2,
      delay: Number(getEnv('PAYMENT_RETRY_DELAY')) || 1000,
    },
    fallback: {
      enabled: getEnv('PAYMENT_FALLBACK_ENABLED') !== 'false',
      strategy: 'priority',  // 按优先级降级
    },
  }
}

function parseProductMap(value?: string): Record<string, string> {
  if (!value) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    )
  } catch {
    return {} // Waffo configuration must not break Creem initialization
  }
}
