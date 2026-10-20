import type { CheckoutParams, CheckoutResult, WebhookResult } from './payment-types'

/**
 * 支付提供商统一接口
 * 所有支付方式（Stripe、Creem等）必须实现此接口
 */
export interface IPaymentProvider {
  /** 提供商名称 */
  readonly name: string

  /** 是否已启用 */
  readonly enabled: boolean

  /**
   * 创建支付会话
   * 支持订阅和一次性支付两种模式
   */
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>

  /**
   * 处理 Webhook 回调
   * @param payload - 原始请求体
   * @param signature - 签名（用于验证）
   */
  handleWebhook(payload: unknown, signature?: string): Promise<WebhookResult>

  /**
   * 健康检查（可选）
   * 用于检测支付提供商是否可用
   */
  healthCheck?(): Promise<boolean>
}
