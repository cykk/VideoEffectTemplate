import { and, eq, lte, ne, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, type DrizzleClient } from '@markless/server/src/lib/db/client'
import { orders } from '@markless/server/src/lib/db/schema/orders'
import { userSubscriptions } from '@markless/server/src/lib/db/schema/subscriptions'
import { subscriptionLogs } from '@markless/server/src/lib/db/schema/subscription-logs'
import { creditTransactions, userCredits } from '@markless/server/src/lib/db/schema/credits'
import { waffoEvents, waffoOrders, waffoPayments, waffoRefunds } from '@markless/server/src/lib/db/schema/waffo'
import { CreditService } from '@markless/server/src/lib/credits/service'
import { moneyUnits, waffoSubscriptionGrantKey, type WaffoEvent } from './events'
import { getWaffoSettings } from './config'

type Tx = Parameters<Parameters<DrizzleClient['transaction']>[0]>[0]
type Link = typeof waffoOrders.$inferSelect
type Order = typeof orders.$inferSelect

export async function receiveWaffoEvent(event: WaffoEvent) {
  const config = getWaffoSettings()
  if (event.mode !== config.mode || event.storeId !== config.storeId) throw new Error('Waffo environment or store mismatch')
  await db.insert(waffoEvents).values({ id: nanoid(), mode: event.mode, storeId: event.storeId,
    eventType: event.eventType, eventId: event.eventId, payload: event }).onConflictDoNothing()
}

async function grantSubscription(tx: Tx, order: Order, link: Link) {
  const snapshot = link.metadata.subscriptionSnapshot as WaffoEvent | undefined
  if (!snapshot || !['active', 'canceling'].includes(snapshot.data.orderStatus || '')) return
  const data = snapshot.data
  if (!Number.isSafeInteger(data.periodNumber) || data.periodNumber < 1) throw new Error('Missing subscription billing period number')
  const start = new Date(data.currentPeriodStart || '')
  const end = new Date(data.currentPeriodEnd || '')
  if (!Number.isFinite(+start) || !Number.isFinite(+end) || end <= start) throw new Error('Missing subscription period')
  if (end <= new Date() || start > new Date()) return // Do not revive expired or future access.
  const meta = order.metadata as Record<string, unknown>
  const interval = meta.subscription_interval as 'month' | 'year'
  const quota = Number(meta.credits_per_period)
  if (!['month', 'year'].includes(interval) || !Number.isSafeInteger(quota) || quota <= 0) throw new Error('Invalid subscription snapshot')
  if (data.billingPeriod !== (interval === 'year' ? 'yearly' : 'monthly')) throw new Error('Subscription interval mismatch')
  const payments = await tx.select().from(waffoPayments).where(eq(waffoPayments.orderId, order.id))
  const receipt = payments.find(p => p.periodNumber === data.periodNumber && (p.charged === null || moneyUnits(p.charged) > BigInt(0)))
  if (!receipt) return // activated/renewed and payment_succeeded are delivered independently.
  const refunds = await tx.select().from(waffoRefunds).where(and(eq(waffoRefunds.orderId, order.id), eq(waffoRefunds.status, 'succeeded')))
  if (refunds.some(r => r.paymentId === receipt.paymentId)) {
    await tx.update(waffoOrders).set({ reviewReason: 'subscription_payment_refunded' }).where(eq(waffoOrders.orderId, order.id))
    return
  }
  const existing = await tx.select().from(userSubscriptions).where(eq(userSubscriptions.userId, order.userId)).for('update')
  const originId = meta.waffo_origin_subscription_id as string | undefined
  const conflict = existing.find(s => s.id !== link.subscriptionId && s.id !== originId && ['active', 'past_due', 'paused'].includes(s.status))
  if (conflict) throw new Error('Conflicting subscription requires review')
  if (originId) {
    const origin = existing.find(s => s.id === originId)
    if (!origin || origin.provider !== 'waffo') throw new Error('Invalid plan change origin')
    await tx.update(userSubscriptions).set({ status: 'expired', updatedAt: new Date(), scheduledPlanId: null,
      scheduledPlanName: null, scheduledCreditsPerPeriod: null, scheduledInterval: null, scheduledChangeAt: null,
      scheduledChangeType: null }).where(eq(userSubscriptions.id, originId))
  }
  let subscription = existing.find(s => s.id === link.subscriptionId)
  if (subscription && subscription.currentPeriodStart > start) return
  const id = subscription?.id || nanoid()
  const values = { userId: order.userId, provider: 'waffo', providerSubscriptionId: data.orderId,
    planId: order.productId, planName: order.productName, interval, creditsPerPeriod: quota,
    status: 'active', currentPeriodStart: start, currentPeriodEnd: end,
    cancelAtPeriodEnd: data.orderStatus === 'canceling' ? 1 : 0,
    cancelAt: data.orderStatus === 'canceling' ? end : null, updatedAt: new Date() }
  if (subscription) {
    ;[subscription] = await tx.update(userSubscriptions).set(values).where(eq(userSubscriptions.id, id)).returning()
  } else {
    ;[subscription] = await tx.insert(userSubscriptions).values({ id, ...values }).returning()
  }
  const key = waffoSubscriptionGrantKey(id, start)
  const [already] = await tx.select().from(creditTransactions).where(eq(creditTransactions.idempotencyKey, key))
  if (!already) {
    await CreditService.expireSubscriptionCredits(order.userId, tx)
    await CreditService.grantCredits({ userId: order.userId, amount: interval === 'year' ? Math.floor(quota / 12) : quota,
      source: 'subscription', type: 'subscription_grant', subscriptionId: id, orderId: order.id,
      description: 'SUBSCRIPTION_CREDITS_GRANTED', idempotencyKey: key, tx,
      metadata: { provider: 'waffo', payment_id: receipt.paymentId, period_start: start.toISOString() } })
    await tx.update(userSubscriptions).set({ lastCreditGrantAt: start, creditGrantCount: interval === 'year' ? 1 : 0 }).where(eq(userSubscriptions.id, id))
    await tx.insert(subscriptionLogs).values({ subscriptionId: id, userId: order.userId,
      action: 'renew', newPlanId: order.productId, newStatus: 'active', metadata: { provider: 'waffo', payment_id: receipt.paymentId } })
  }
  await tx.update(waffoOrders).set({ subscriptionId: id, fulfilledAt: link.fulfilledAt || new Date(), reviewReason: null }).where(eq(waffoOrders.orderId, order.id))
  await tx.update(orders).set({ status: 'paid', paidAt: order.paidAt || new Date(), updatedAt: new Date() }).where(eq(orders.id, order.id))
}

async function processRefund(tx: Tx, event: WaffoEvent, order: Order) {
  const data = event.data
  if (!data.paymentId || !data.refundStatus) throw new Error('Invalid refund event')
  const amount = data.refundedAmount || data.amount
  if (moneyUnits(amount) <= BigInt(0) || data.currency !== order.currency) throw new Error('Invalid refund amount or currency')
  await tx.insert(waffoRefunds).values({ id: nanoid(), orderId: order.id, mode: event.mode, storeId: event.storeId,
    refundId: event.eventId, paymentId: data.paymentId, amount, currency: data.currency,
    status: data.refundStatus, payload: event, creditStatus: data.refundStatus === 'succeeded' ? 'review' : 'not_required',
  }).onConflictDoUpdate({ target: [waffoRefunds.mode, waffoRefunds.storeId, waffoRefunds.refundId],
    set: { status: data.refundStatus, payload: event, updatedAt: new Date() } })
  if (data.refundTicketMerchantExternalId) await tx.update(waffoRefunds).set({ status: data.refundStatus === 'succeeded' ? 'completed' : 'failed', creditStatus: 'not_required', updatedAt: new Date() })
    .where(and(eq(waffoRefunds.id, data.refundTicketMerchantExternalId), eq(waffoRefunds.orderId, order.id), eq(waffoRefunds.mode, event.mode), eq(waffoRefunds.storeId, event.storeId)))
  if (data.refundStatus !== 'succeeded') return
  const payments = await tx.select().from(waffoPayments).where(eq(waffoPayments.orderId, order.id))
  const refunds = await tx.select().from(waffoRefunds).where(and(eq(waffoRefunds.orderId, order.id), eq(waffoRefunds.status, 'succeeded')))
  const full = payments.length > 0 && payments.every(p => {
    const charged = p.charged
    return charged && moneyUnits(charged) > BigInt(0) && refunds.filter(r => r.paymentId === p.paymentId)
      .reduce((sum, r) => sum + moneyUnits(r.amount), BigInt(0)) >= moneyUnits(charged)
  })
  if (full) await tx.update(orders).set({ status: 'refunded', updatedAt: new Date() }).where(eq(orders.id, order.id))
  // Aggregated credit balances cannot prove lot ownership. Automatically revoke only
  // an entirely unspent account containing solely this purchase; all else is reviewed.
  const [account] = await tx.select().from(userCredits).where(eq(userCredits.userId, order.userId)).for('update')
  const transactions = await tx.select().from(creditTransactions).where(eq(creditTransactions.userId, order.userId))
  const grant = transactions.find(t => t.idempotencyKey === `order:${order.id}`)
  const alreadyRevoked = transactions.some(t => t.idempotencyKey === `waffo:refund:${order.id}`)
  const safe = full && order.productType === 'one_time' && grant && account && account.totalSpent === 0
    && account.subscriptionCredits === 0 && account.bonusCredits === 0 && account.purchasedCredits === grant.amount
    && transactions.every(t => t.id === grant.id || t.amount === 0)
  if (safe) {
    await tx.update(userCredits).set({ purchasedCredits: 0, totalBalance: 0, updatedAt: new Date() }).where(eq(userCredits.userId, order.userId))
    await tx.insert(creditTransactions).values({ id: nanoid(), userId: order.userId, type: 'adjustment', amount: -grant.amount,
      balanceAfter: 0, source: 'one_time', orderId: order.id, idempotencyKey: `waffo:refund:${order.id}`,
      description: 'WAFFO_REFUND_CREDITS_REVOKED' }).onConflictDoNothing()
    await tx.update(waffoRefunds).set({ creditStatus: 'resolved', reviewNote: 'Unspent isolated purchase revoked' }).where(eq(waffoRefunds.orderId, order.id))
  }
  await tx.update(waffoOrders).set({ reviewReason: safe || alreadyRevoked || refunds.every(r => r.creditStatus === 'resolved') ? null : 'refund_credit_review', updatedAt: new Date() }).where(eq(waffoOrders.orderId, order.id))
}

async function applyEvent(tx: Tx, event: WaffoEvent) {
  const data = event.data
  const [candidate] = data.orderMerchantExternalId
    ? await tx.select().from(orders).where(eq(orders.id, data.orderMerchantExternalId)) : []
  if (!candidate || candidate.paymentProvider !== 'waffo') throw new Error('Waffo order not found')
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${candidate.userId}))`)
  const [order] = data.orderMerchantExternalId
    ? await tx.select().from(orders).where(eq(orders.id, data.orderMerchantExternalId)).for('update') : []
  if (!order || order.paymentProvider !== 'waffo') throw new Error('Waffo order not found')
  const [link] = await tx.select().from(waffoOrders).where(eq(waffoOrders.orderId, order.id)).for('update')
  if (!link || link.mode !== event.mode || link.storeId !== event.storeId || (link.remoteOrderId && link.remoteOrderId !== data.orderId)) throw new Error('Waffo order identity mismatch')
  if (order.currency !== data.currency) throw new Error('Waffo currency mismatch')
  await tx.update(waffoOrders).set({ remoteOrderId: data.orderId, updatedAt: new Date() }).where(eq(waffoOrders.orderId, order.id))
  if (event.eventType.startsWith('refund.')) { await processRefund(tx, event, order); return }
  if (event.eventType === 'order.completed' || event.eventType === 'subscription.payment_succeeded') {
    if (!data.paymentId || data.paymentStatus !== 'succeeded') throw new Error('Payment not succeeded')
    if (moneyUnits(data.listPrice?.subtotal) !== moneyUnits(order.amount)) throw new Error('Waffo amount mismatch')
    await tx.insert(waffoPayments).values({ id: nanoid(), mode: event.mode, storeId: event.storeId, orderId: order.id,
      paymentId: data.paymentId, remoteOrderId: data.orderId, currency: data.currency, subtotal: data.listPrice?.subtotal,
      total: data.listPrice?.total, tax: data.listPrice?.taxAmount, charged: data.chargedAmount,
      periodNumber: data.periodNumber, payload: event }).onConflictDoNothing()
    const previousRefunds = await tx.select().from(waffoRefunds).where(and(eq(waffoRefunds.orderId, order.id), eq(waffoRefunds.status, 'succeeded')))
    for (const refund of previousRefunds) await processRefund(tx, refund.payload as WaffoEvent, order)
    if (order.productType === 'subscription') { await grantSubscription(tx, order, link); return }
    if (event.eventType !== 'order.completed' || data.orderStatus !== 'completed') throw new Error('Invalid one-time payment')
    const refunds = await tx.select().from(waffoRefunds).where(and(eq(waffoRefunds.orderId, order.id), eq(waffoRefunds.status, 'succeeded')))
    if (refunds.length || order.status === 'refunded') {
      if (!link.fulfilledAt) await tx.update(waffoOrders).set({ reviewReason: 'refund_before_fulfillment' }).where(eq(waffoOrders.orderId, order.id))
      return
    }
    const meta = order.metadata as Record<string, unknown>
    const amount = Number(meta.credits || 0) + Number(meta.bonus_credits || 0)
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Invalid credit snapshot')
    await CreditService.grantCredits({ userId: order.userId, amount, source: 'one_time', type: 'purchase', orderId: order.id,
      description: 'WAFFO_PURCHASE_CREDITS', idempotencyKey: `order:${order.id}`, tx, metadata: { provider: 'waffo', payment_id: data.paymentId } })
    await tx.update(orders).set({ status: 'paid', paidAt: order.paidAt || new Date(), updatedAt: new Date() }).where(eq(orders.id, order.id))
    await tx.update(waffoOrders).set({ fulfilledAt: link.fulfilledAt || new Date() }).where(eq(waffoOrders.orderId, order.id))
    return
  }
  if (!event.eventType.startsWith('subscription.')) return
  const eventTime = new Date(event.timestamp)
  if (link.lastEventAt && link.lastEventAt > eventTime) return
  if (link.metadata.terminal && event.eventType !== 'subscription.canceled') return
  if (event.eventType === 'subscription.plan_change_failed') {
    await tx.update(orders).set({ status: 'failed', updatedAt: new Date() }).where(eq(orders.id, order.id))
    const originId = (order.metadata as Record<string, unknown>).waffo_origin_subscription_id as string | undefined
    if (originId) await tx.update(userSubscriptions).set({ scheduledPlanId: null, scheduledPlanName: null,
      scheduledCreditsPerPeriod: null, scheduledInterval: null, scheduledChangeAt: null, scheduledChangeType: null,
      updatedAt: new Date() }).where(and(eq(userSubscriptions.id, originId), eq(userSubscriptions.provider, 'waffo'),
        eq(userSubscriptions.scheduledPlanId, order.productId)))
    await tx.update(waffoOrders).set({ lastEventAt: eventTime, metadata: { ...link.metadata, terminal: true } }).where(eq(waffoOrders.orderId, order.id))
    return
  }
  if (event.eventType === 'subscription.plan_change_scheduled') {
    const originId = (order.metadata as Record<string, unknown>).waffo_origin_subscription_id as string
    if (originId) await tx.update(userSubscriptions).set({ scheduledPlanId: order.productId, scheduledPlanName: order.productName,
      scheduledCreditsPerPeriod: Number((order.metadata as Record<string, unknown>).credits_per_period),
      scheduledInterval: (order.metadata as Record<string, unknown>).subscription_interval as string,
      scheduledChangeAt: data.planChange?.effectiveDate ? new Date(data.planChange.effectiveDate) : null,
      scheduledChangeType: 'downgrade', cancelAtPeriodEnd: 1, cancelAt: data.planChange?.effectiveDate ? new Date(data.planChange.effectiveDate) : null, updatedAt: new Date() }).where(and(eq(userSubscriptions.id, originId), eq(userSubscriptions.provider, 'waffo')))
    if (originId) {
      const [originLink] = await tx.select().from(waffoOrders).where(eq(waffoOrders.subscriptionId, originId)).for('update')
      const snapshot = originLink?.metadata.subscriptionSnapshot as WaffoEvent | undefined
      if (originLink && snapshot) await tx.update(waffoOrders).set({ lastEventAt: eventTime,
        metadata: { ...originLink.metadata, subscriptionSnapshot: { ...snapshot, data: { ...snapshot.data, orderStatus: 'canceling' } } } })
        .where(eq(waffoOrders.orderId, originLink.orderId))
    }
    return
  }
  const nextLink = { ...link, metadata: { ...link.metadata, subscriptionSnapshot: event, terminal: event.eventType === 'subscription.canceled' } }
  await tx.update(waffoOrders).set({ lastEventAt: eventTime, metadata: nextLink.metadata }).where(eq(waffoOrders.orderId, order.id))
  if (event.eventType === 'subscription.canceled' || event.eventType === 'subscription.past_due') {
    if (event.eventType === 'subscription.canceled' && order.status === 'pending') {
      await tx.update(orders).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(orders.id, order.id))
    }
    if (link.subscriptionId) {
      await tx.update(userSubscriptions).set({ status: event.eventType === 'subscription.canceled' ? 'expired' : 'past_due', updatedAt: new Date() }).where(and(eq(userSubscriptions.id, link.subscriptionId), eq(userSubscriptions.provider, 'waffo')))
      const [other] = await tx.select().from(userSubscriptions).where(and(eq(userSubscriptions.userId, order.userId), ne(userSubscriptions.id, link.subscriptionId), eq(userSubscriptions.status, 'active')))
      if (!other) await CreditService.expireSubscriptionCredits(order.userId, tx)
    }
    return
  }
  await grantSubscription(tx, order, nextLink)
}

export async function processWaffoEvents(limit = 25) {
  let processed = 0, failed = 0
  for (let index = 0; index < limit; index++) {
    const outcome = await db.transaction(async tx => {
      const [item] = await tx.select().from(waffoEvents).where(and(eq(waffoEvents.status, 'pending'), lte(waffoEvents.nextAttemptAt, new Date())))
        .orderBy(waffoEvents.createdAt).limit(1).for('update', { skipLocked: true })
      if (!item) return null
      try {
        // A savepoint rolls back partial business writes but retains the inbox row.
        await tx.transaction(async inner => applyEvent(inner, item.payload as WaffoEvent))
        await tx.update(waffoEvents).set({ status: 'processed', processedAt: new Date(), error: null }).where(eq(waffoEvents.id, item.id))
        return true
      } catch (error) {
        const attempts = item.attempts + 1
        await tx.update(waffoEvents).set({ attempts, status: attempts >= 8 ? 'failed' : 'pending',
          nextAttemptAt: new Date(Date.now() + Math.min(3600000, 10000 * 2 ** attempts)),
          error: error instanceof Error ? error.message.slice(0, 300) : 'Processing failed' }).where(eq(waffoEvents.id, item.id))
        if (attempts >= 8) console.error('[Waffo] Event requires review', { id: item.id, eventType: item.eventType })
        return false
      }
    })
    if (outcome === null) break
    if (outcome) processed++; else failed++
  }
  return { processed, failed }
}
