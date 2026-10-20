import { createHash, sign } from 'node:crypto'
import { getWaffoSettings } from './config'

export class WaffoApiError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}
/** Do not automatically retry writes: a timeout can mean the write succeeded. */
export async function waffoRequest<T>(path: string, body: unknown, token?: string): Promise<T> {
  const config = getWaffoSettings()
  const bodyText = JSON.stringify(body)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) {
    headers.Authorization = `Bearer ${token}`
    headers['X-Environment'] = config.mode
  } else {
    if (!config.merchantId || !config.privateKey) throw new Error('app.payments.checkout.error.unavailable')
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const hash = createHash('sha256').update(bodyText).digest('base64')
    headers['X-Merchant-Id'] = config.merchantId
    headers['X-Timestamp'] = timestamp
    headers['X-Signature'] = sign('sha256', Buffer.from(`POST\n${path}\n${timestamp}\n${hash}`), config.privateKey.replace(/\\n/g, '\n')).toString('base64')
  }
  const response = await fetch(`https://api.waffo.ai${path}`, {
    method: 'POST', headers, body: bodyText, signal: AbortSignal.timeout(12000),
  })
  const payload = await response.json() as { data?: T; errors?: Array<{ message?: string }> }
  if (!response.ok || payload.errors?.length || !payload.data) {
    throw new WaffoApiError(response.status, 'app.payments.checkout.error.provider')
  }
  return payload.data
}
export async function waffoCustomerToken(buyerIdentity: string) {
  const { storeId } = getWaffoSettings()
  if (!storeId) throw new Error('app.payments.checkout.error.unavailable')
  return waffoRequest<{ token: string; portalUrl?: string }>('/v1/actions/auth/issue-session-token', {
    storeId, buyerIdentity, purpose: 'portal',
  })
}
