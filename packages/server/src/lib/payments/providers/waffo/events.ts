import { createVerify } from 'node:crypto'

export type WaffoEvent = {
  eventType: string; eventId: string; id?: string; mode: 'test' | 'prod'; storeId: string; timestamp: string
  data: {
    orderId: string; orderMerchantExternalId?: string; orderStatus?: string; paymentStatus?: string
    paymentId?: string; refundStatus?: string; refundTicketMerchantExternalId?: string; currency: string; buyerEmail?: string
    chargedAmount?: string; refundedAmount?: string; originalChargedAmount?: string; amount?: string
    listPrice?: { subtotal?: string; taxAmount?: string; total?: string }
    originalPayment?: { subtotal?: string; taxAmount?: string; total?: string }
    planPrice?: { subtotal?: string; taxAmount?: string; total?: string }
    periodNumber?: number; billingPeriod?: string; currentPeriodStart?: string; currentPeriodEnd?: string
    canceledAt?: string; orderMetadata?: Record<string, unknown>
    planChange?: { effectiveDate?: string; direction?: string }
  }
}

export function verifyWaffoSignature(raw: string, header: string, publicKey: string, now = Date.now()) {
  const parts = Object.fromEntries(header.split(',').map(part => {
    const [key, ...value] = part.trim().split('='); return [key, value.join('=')]
  }))
  const timestamp = Number(parts.t)
  if (!Number.isFinite(timestamp) || !parts.v1 || Math.abs(now - timestamp) > 45 * 60 * 1000) return false
  try {
    const verifier = createVerify('RSA-SHA256'); verifier.update(`${parts.t}.${raw}`); verifier.end()
    return verifier.verify(publicKey.replace(/\\n/g, '\n'), Buffer.from(parts.v1, 'base64'))
  } catch { return false }
}

export function parseWaffoEvent(raw: string): WaffoEvent {
  const event = JSON.parse(raw) as WaffoEvent
  if (!event || !event.eventType || !event.eventId || !event.storeId || !['test', 'prod'].includes(event.mode)
    || !Number.isFinite(Date.parse(event.timestamp)) || !event.data?.orderId || !event.data.currency) throw new Error('Invalid Waffo event')
  return event
}

/** Exact decimal conversion: never round mismatching prices into equality. */
export function moneyUnits(value: unknown): bigint {
  if (typeof value !== 'string' || !/^\d+(\.\d{1,4})?$/.test(value)) throw new Error('Invalid monetary amount')
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * BigInt(10000) + BigInt(fraction.padEnd(4, '0'))
}

export function waffoSubscriptionGrantKey(subscriptionId: string, start: Date) {
  return `waffo:subscription:${subscriptionId}:period:${start.toISOString()}`
}
