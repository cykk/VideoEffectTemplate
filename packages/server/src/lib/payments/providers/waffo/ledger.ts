import { inArray } from 'drizzle-orm'
import { db } from '@markless/server/src/lib/db/client'
import { waffoPayments, waffoRefunds } from '@markless/server/src/lib/db/schema/waffo'
import { moneyUnits } from './events'

function display(units: bigint) {
  return `${units / BigInt(10000)}.${(units % BigInt(10000)).toString().padStart(4, '0')}`
}
export async function waffoLedger(orderIds: string[]) {
  if (!orderIds.length) return new Map<string, { charged: string; receipts: Array<{ id: string; charged: string | null; tax: string | null; refunded: string; currency: string }> }>()
  const [payments, refunds] = await Promise.all([
    db.select().from(waffoPayments).where(inArray(waffoPayments.orderId, orderIds)),
    db.select().from(waffoRefunds).where(inArray(waffoRefunds.orderId, orderIds)),
  ])
  return new Map(orderIds.map(orderId => {
    const receipts = payments.filter(p => p.orderId === orderId).map(payment => ({ id: payment.paymentId,
      charged: payment.charged, tax: payment.tax, currency: payment.currency,
      refunded: display(refunds.filter(r => r.orderId === orderId && r.paymentId === payment.paymentId && r.status === 'succeeded')
        .reduce((sum, r) => sum + moneyUnits(r.amount), BigInt(0))),
    }))
    return [orderId, { charged: display(receipts.reduce((sum, r) => sum + (r.charged ? moneyUnits(r.charged) : BigInt(0)), BigInt(0))), receipts }]
  }))
}
