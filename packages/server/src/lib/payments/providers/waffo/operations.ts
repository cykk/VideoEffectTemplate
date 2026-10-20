import { createHash } from 'node:crypto'
import { and, eq, isNull, lt, lte, ne, or, sql } from 'drizzle-orm'
import { db } from '@markless/server/src/lib/db/client'
import { orders } from '@markless/server/src/lib/db/schema/orders'
import { waffoOrders, waffoPayments, waffoRefunds } from '@markless/server/src/lib/db/schema/waffo'
import { userSubscriptions } from '@markless/server/src/lib/db/schema/subscriptions'
import { creditTransactions } from '@markless/server/src/lib/db/schema/credits'
import { CreditService } from '@markless/server/src/lib/credits/service'
import { getEnv } from '@markless/shared/src/lib/config/env'
import { getWaffoSettings } from './config'
import { waffoRequest } from './client'
import { processWaffoEvents, receiveWaffoEvent } from './processor'
import { waffoSubscriptionGrantKey } from './events'

type RemoteOrder = { id: string; status: string; updatedAt: string; currentPeriodStart?: string; currentPeriodEnd?: string; currentPeriodNumber?: number }
type RemotePayment = { id: string; orderId: string; status: string; periodNumber?: number; createdAt: string;
  amount: { display: string; currency: string }; snapshotAmountDetails: { subtotal: string; total: string; taxAmount: string; currency: string } }
type RemoteRefund = { id: string; paymentId: string; status: string; createdAt: string; refundTicketMerchantExternalId?: string; pspAmountDetails?: { amount: string; currency: string } }

/** Queried data uses the same durable, idempotent processing path as webhooks. */
export async function reconcileWaffoOrders(limit = 10) {
  const config = getWaffoSettings()
  const candidates = await db.select({ order: orders, link: waffoOrders }).from(waffoOrders)
    .innerJoin(orders, eq(orders.id, waffoOrders.orderId))
    .where(and(eq(waffoOrders.mode, config.mode), eq(waffoOrders.storeId, config.storeId),
      or(isNull(waffoOrders.lastReconciledAt), lt(waffoOrders.lastReconciledAt, new Date(Date.now() - 5 * 60000)))))
    .orderBy(sql`${waffoOrders.lastReconciledAt} asc nulls first`).limit(limit)
  let reconciled = 0, failed = 0
  for (const { order, link } of candidates) {
    try {
      const collection = order.productType === 'subscription' ? 'subscriptionOrders' : 'onetimeOrders'
      const extra = order.productType === 'subscription' ? 'currentPeriodStart currentPeriodEnd currentPeriodNumber' : ''
      const remote = await waffoRequest<Record<string, RemoteOrder[]>>('/v1/graphql', {
        query: `query($storeId: String!, $ref: String!) { ${collection}(storeId: $storeId, filter: {orderMerchantExternalId: {eq: $ref}}, limit: 2) { id status updatedAt ${extra} } }`,
        variables: { storeId: config.storeId, ref: order.id },
      })
      const found = remote[collection]
      if (found.length > 1) throw new Error('Multiple remote orders for one reference')
      const state = found[0]
      if (state) {
        if (link.remoteOrderId && link.remoteOrderId !== state.id) throw new Error('Remote order changed')
        const base = { mode: config.mode, storeId: config.storeId, timestamp: state.updatedAt || new Date().toISOString() }
        const data = { orderId: state.id, orderMerchantExternalId: order.id, currency: order.currency }
        // Fetch refunds before receipts, preventing a lost payment webhook from granting
        // an already refunded purchase during reconciliation.
        for (let offset = 0; offset < 10000; offset += 100) {
          const result = await waffoRequest<{ payments: RemotePayment[] }>('/v1/graphql', {
            query: `query($ref: String!, $offset: Int!) { payments(filter: {orderMerchantExternalId: {eq: $ref}}, limit: 100, offset: $offset) { id orderId status periodNumber createdAt amount { display currency } snapshotAmountDetails { subtotal taxAmount total currency } } }`,
            variables: { ref: order.id, offset },
          })
          for (const payment of result.payments) {
            if (payment.orderId !== state.id || payment.status !== 'succeeded') continue
            const refundResult = await waffoRequest<{ refunds: RemoteRefund[] }>('/v1/graphql', {
              query: `query($id: String!) { refunds(filter: {paymentId: {eq: $id}}, limit: 100) { id paymentId status createdAt refundTicketMerchantExternalId pspAmountDetails { amount currency } } }`, variables: { id: payment.id },
            })
            for (const refund of refundResult.refunds) {
              if (!['succeeded', 'failed'].includes(refund.status) || !refund.pspAmountDetails?.amount) continue
              await receiveWaffoEvent({ ...base, eventType: `refund.${refund.status}`, eventId: refund.id, timestamp: refund.createdAt,
                data: { ...data, paymentId: payment.id, refundStatus: refund.status, refundedAmount: refund.pspAmountDetails.amount,
                  originalChargedAmount: payment.amount.display, currency: refund.pspAmountDetails.currency, refundTicketMerchantExternalId: refund.refundTicketMerchantExternalId } })
            }
            await receiveWaffoEvent({ ...base, eventType: order.productType === 'subscription' ? 'subscription.payment_succeeded' : 'order.completed',
              eventId: payment.id, timestamp: payment.createdAt, data: { ...data, orderStatus: 'completed', paymentId: payment.id,
                paymentStatus: 'succeeded', periodNumber: payment.periodNumber, currency: payment.amount.currency,
                chargedAmount: payment.amount.display, listPrice: { subtotal: String(payment.snapshotAmountDetails.subtotal),
                  taxAmount: String(payment.snapshotAmountDetails.taxAmount), total: String(payment.snapshotAmountDetails.total) } } })
          }
          if (result.payments.length < 100) break
        }
        if (order.productType === 'subscription') {
          const eventType = ({ active: 'subscription.recovered', canceling: 'subscription.canceling', canceled: 'subscription.canceled', past_due: 'subscription.past_due' } as Record<string, string>)[state.status]
          if (eventType) await receiveWaffoEvent({ ...base, eventType,
            eventId: `reconcile:${createHash('sha256').update(JSON.stringify(state)).digest('hex')}`,
            data: { ...data, orderStatus: state.status, currentPeriodStart: state.currentPeriodStart, currentPeriodEnd: state.currentPeriodEnd,
              periodNumber: state.currentPeriodNumber, billingPeriod: (order.metadata as Record<string, unknown>).subscription_interval === 'year' ? 'yearly' : 'monthly' } })
        } else if (state.status === 'canceled' && order.status === 'pending') {
          await db.update(orders).set({ status: 'cancelled', updatedAt: new Date() }).where(and(eq(orders.id, order.id), eq(orders.status, 'pending')))
        }
      }
      // An absent remote order after expiry is left for review: a timeout is not
      // sufficient evidence that no payable remote checkout exists.
      if (!state && link.expiresAt && link.expiresAt < new Date()) {
        await db.update(waffoOrders).set({ reviewReason: 'checkout_not_found_after_expiry' }).where(eq(waffoOrders.orderId, order.id))
      } else if (state && ['checkout_response_unknown', 'reconciliation_failed', 'checkout_not_found_after_expiry'].includes(link.reviewReason || '')) {
        await db.update(waffoOrders).set({ reviewReason: null }).where(eq(waffoOrders.orderId, order.id))
      }
      reconciled++
    } catch {
      failed++
      console.error('[Waffo] Reconciliation requires attention', { orderId: order.id })
      await db.update(waffoOrders).set({ reviewReason: link.reviewReason || 'reconciliation_failed' }).where(eq(waffoOrders.orderId, order.id))
    } finally {
      await db.update(waffoOrders).set({ lastReconciledAt: new Date() }).where(eq(waffoOrders.orderId, order.id))
    }
  }
  return { reconciled, failed }
}

function monthlyWindow(start: Date, index: number) {
  const day = start.getUTCDate()
  const value = new Date(start); value.setUTCDate(1); value.setUTCMonth(value.getUTCMonth() + index)
  const end = new Date(value); end.setUTCMonth(end.getUTCMonth() + 1); end.setUTCDate(0)
  value.setUTCDate(Math.min(day, end.getUTCDate()))
  return value
}

export async function grantWaffoYearlyCredits(now = new Date()) {
  const subscriptions = await db.select().from(userSubscriptions).where(and(eq(userSubscriptions.provider, 'waffo'), eq(userSubscriptions.status, 'active'), eq(userSubscriptions.interval, 'year')))
  let granted = 0
  for (const candidate of subscriptions) {
    await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${candidate.userId}))`)
      const [candidateLink] = await tx.select().from(waffoOrders).where(eq(waffoOrders.subscriptionId, candidate.id))
      if (!candidateLink) return
      await tx.select().from(orders).where(eq(orders.id, candidateLink.orderId)).for('update')
      const [link] = await tx.select().from(waffoOrders).where(eq(waffoOrders.orderId, candidateLink.orderId)).for('update')
      const [subscription] = await tx.select().from(userSubscriptions).where(eq(userSubscriptions.id, candidate.id)).for('update')
      if (!subscription || subscription.status !== 'active' || subscription.currentPeriodEnd <= now || subscription.currentPeriodStart > now) return
      const config = getWaffoSettings()
      if (!link || link.mode !== config.mode || link.storeId !== config.storeId || !link.fulfilledAt || link.reviewReason) return
      // Only grant the current month after downtime: never accumulate expired months.
      let index = 0
      while (index < 11 && monthlyWindow(subscription.currentPeriodStart, index + 1) <= now) index++
      const start = monthlyWindow(subscription.currentPeriodStart, index)
      const key = waffoSubscriptionGrantKey(subscription.id, start)
      const [existing] = await tx.select().from(creditTransactions).where(eq(creditTransactions.idempotencyKey, key))
      if (existing) return
      await CreditService.expireSubscriptionCredits(subscription.userId, tx)
      await CreditService.grantCredits({ userId: subscription.userId, amount: Math.floor(subscription.creditsPerPeriod / 12),
        source: 'subscription', type: 'subscription_grant', subscriptionId: subscription.id,
        idempotencyKey: key, description: 'SUBSCRIPTION_YEARLY_MONTHLY_DRIP', tx, metadata: { provider: 'waffo', grant_window_start: start.toISOString() } })
      await tx.update(userSubscriptions).set({ creditGrantCount: index + 1, lastCreditGrantAt: start, updatedAt: new Date() }).where(eq(userSubscriptions.id, subscription.id))
      granted++
    })
  }
  return { granted }
}

/** Fail closed at the paid boundary even when provider callbacks are delayed. */
export async function expireWaffoSubscriptions(now = new Date()) {
  const config = getWaffoSettings()
  const candidates = await db.select().from(userSubscriptions).where(and(eq(userSubscriptions.provider, 'waffo'),
    eq(userSubscriptions.status, 'active'), lte(userSubscriptions.currentPeriodEnd, now)))
  let expired = 0
  for (const candidate of candidates) await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${candidate.userId}))`)
    const [link] = await tx.select().from(waffoOrders).where(eq(waffoOrders.subscriptionId, candidate.id))
    if (!link || link.mode !== config.mode || link.storeId !== config.storeId) return
    const [subscription] = await tx.select().from(userSubscriptions).where(eq(userSubscriptions.id, candidate.id)).for('update')
    if (!subscription || subscription.status !== 'active' || subscription.currentPeriodEnd > now) return
    await tx.update(userSubscriptions).set({ status: subscription.cancelAtPeriodEnd ? 'expired' : 'past_due', updatedAt: now })
      .where(eq(userSubscriptions.id, subscription.id))
    const [other] = await tx.select().from(userSubscriptions).where(and(eq(userSubscriptions.userId, candidate.userId),
      ne(userSubscriptions.id, candidate.id), eq(userSubscriptions.status, 'active')))
    if (!other) await CreditService.expireSubscriptionCredits(candidate.userId, tx)
    expired++
  })
  return { expired }
}

export async function runWaffoOperations() {
  if (getEnv('WAFFO_OPERATIONS_ENABLED') !== 'true') return { disabled: true }
  const before = await processWaffoEvents()
  const reconciliation = await reconcileWaffoOrders()
  const after = await processWaffoEvents()
  const expiration = await expireWaffoSubscriptions()
  const yearly = await grantWaffoYearlyCredits()
  return { before, reconciliation, after, expiration, yearly }
}
