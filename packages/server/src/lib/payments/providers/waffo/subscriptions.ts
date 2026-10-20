import { and, eq, ne, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '@markless/server/src/lib/db/client'
import { orders } from '@markless/server/src/lib/db/schema/orders'
import { userSubscriptions, type UserSubscription } from '@markless/server/src/lib/db/schema/subscriptions'
import { waffoOrders } from '@markless/server/src/lib/db/schema/waffo'
import { getProductById } from '@markless/shared/src/lib/products/config'
import { getPaymentSuccessBaseUrl } from '@markless/shared/src/lib/config/urls'
import { getWaffoProduct, getWaffoSettings, assertWaffoCheckoutReady } from './config'
import { CreditService } from '@markless/server/src/lib/credits/service'
import type { WaffoEvent } from './events'
import { createWaffoOrder } from './checkout'
import { waffoCustomerToken, waffoRequest } from './client'

async function ownedLink(subscription: UserSubscription) {
  const [link] = await db.select().from(waffoOrders).where(eq(waffoOrders.subscriptionId, subscription.id))
  const config = getWaffoSettings()
  if (subscription.provider !== 'waffo' || !link || link.mode !== config.mode || link.storeId !== config.storeId) throw new Error('app.payments.checkout.error.unavailable')
  const [order] = await db.select().from(orders).where(eq(orders.id, link.orderId))
  if (!order || order.userId !== subscription.userId) throw new Error('app.payments.checkout.error.unavailable')
  return { link, order }
}

async function recordSubscriptionIntent(subscription: UserSubscription, orderId: string, status: 'active' | 'canceling' | 'canceled') {
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${subscription.userId}))`)
    await tx.select().from(orders).where(eq(orders.id, orderId)).for('update')
    const [link] = await tx.select().from(waffoOrders).where(eq(waffoOrders.orderId, orderId)).for('update')
    const [current] = await tx.select().from(userSubscriptions).where(eq(userSubscriptions.id, subscription.id)).for('update')
    if (!link || !current || current.status === 'expired') return current
    const now = new Date()
    const snapshot = link.metadata.subscriptionSnapshot as WaffoEvent | undefined
    const [updated] = await tx.update(userSubscriptions).set({ status: status === 'canceled' ? 'expired' : 'active',
      cancelAtPeriodEnd: status === 'active' ? 0 : 1, cancelAt: status === 'active' ? null : current.currentPeriodEnd,
      cancelledAt: status === 'active' ? null : now, updatedAt: now }).where(eq(userSubscriptions.id, current.id)).returning()
    await tx.update(waffoOrders).set({ lastEventAt: now, metadata: { ...link.metadata, terminal: status === 'canceled',
      ...(snapshot ? { subscriptionSnapshot: { ...snapshot, timestamp: now.toISOString(), data: { ...snapshot.data, orderStatus: status } } } : {}) } })
      .where(eq(waffoOrders.orderId, orderId))
    if (status === 'canceled') {
      const [other] = await tx.select().from(userSubscriptions).where(and(eq(userSubscriptions.userId, current.userId),
        ne(userSubscriptions.id, current.id), eq(userSubscriptions.status, 'active')))
      if (!other) await CreditService.expireSubscriptionCredits(current.userId, tx)
    }
    return updated
  })
}

export async function cancelWaffoSubscription(subscription: UserSubscription) {
  const { link } = await ownedLink(subscription)
  const result = await waffoRequest<{ status: string }>('/v1/actions/subscription-order/cancel-order', { orderId: subscription.providerSubscriptionId })
  return recordSubscriptionIntent(subscription, link.orderId, result.status === 'canceled' ? 'canceled' : 'canceling')
}

export async function resumeWaffoSubscription(subscription: UserSubscription) {
  const { order, link } = await ownedLink(subscription)
  if (!subscription.cancelAtPeriodEnd || subscription.currentPeriodEnd <= new Date()) throw new Error('app.payments.subscription.error.resume')
  const { token } = await waffoCustomerToken(order.customerEmail.trim().toLowerCase())
  await waffoRequest('/v1/actions/subscription-order/reactivate-order', { orderId: subscription.providerSubscriptionId }, token)
  return recordSubscriptionIntent(subscription, link.orderId, 'active')
}

export async function createWaffoPlanChange(subscription: UserSubscription, newPlanId: string) {
  assertWaffoCheckoutReady()
  const { order: original } = await ownedLink(subscription)
  const product = getProductById(newPlanId)
  const current = getProductById(subscription.planId)
  if (!product || !current || !product.isActive || product.type !== 'subscription' || current.type !== 'subscription' || product.id === current.id) throw new Error('app.payments.subscription.error.plan')
  const upgrade = (product.creditsPerPeriod / (product.interval === 'year' ? 12 : 1)) > (current.creditsPerPeriod / (current.interval === 'year' ? 12 : 1))
    || (current.interval === 'month' && product.interval === 'year' && product.creditsPerPeriod / 12 >= current.creditsPerPeriod)
  const productId = getWaffoProduct(product.id, 'subscription')
  const id = nanoid()
  await createWaffoOrder({ id, userId: subscription.userId, orderNumber: `WF-${Date.now()}-${nanoid(6)}`,
    productId: product.id, productName: product.name, productType: 'subscription', paymentProvider: 'waffo',
    paymentRequestId: nanoid(), amount: product.price.toFixed(2), currency: product.currency,
    customerEmail: original.customerEmail, status: 'pending',
    metadata: { subscription_interval: product.interval, credits_per_period: product.creditsPerPeriod,
      waffo_origin_subscription_id: subscription.id, waffo_change_type: upgrade ? 'upgrade' : 'downgrade' },
  }, subscription.id)
  const successUrl = new URL('/dashboard', getPaymentSuccessBaseUrl())
  if (successUrl.protocol !== 'https:') throw new Error('app.payments.checkout.error.unavailable')
  successUrl.searchParams.set('order_id', id)
  successUrl.searchParams.set('type', 'subscription')
  const session = await waffoRequest<{ sessionId: string; checkoutUrl: string; expiresAt: string }>('/v1/actions/checkout/create-session', {
    productId, currency: product.currency, originOrderId: subscription.providerSubscriptionId,
    changeTiming: upgrade ? 'immediate' : 'next_period', withTrial: false,
    priceSnapshot: { amount: product.price.toFixed(2), taxIncluded: false, taxCategory: getWaffoSettings().taxCategory },
    successUrl: successUrl.toString(), orderMerchantExternalId: id, expiresInSeconds: 1800,
    metadata: { productId: product.id, userId: subscription.userId, originSubscriptionId: subscription.id },
  })
  await db.update(waffoOrders).set({ sessionId: session.sessionId, expiresAt: new Date(session.expiresAt) }).where(eq(waffoOrders.orderId, id))
  // Credentials are minted immediately before returning and never stored or logged.
  const { token } = await waffoCustomerToken(original.customerEmail.trim().toLowerCase())
  const url = new URL(session.checkoutUrl)
  if (url.protocol !== 'https:') throw new Error('app.payments.checkout.error.provider')
  if (getWaffoSettings().mode === 'test') url.searchParams.set('test', 'true')
  url.hash = `token=${encodeURIComponent(token)}`
  return { checkout_url: url.toString(), order_id: id, change_type: upgrade ? 'upgrade' : 'downgrade' }
}

export async function cancelWaffoScheduledChange(subscription: UserSubscription) {
  await ownedLink(subscription)
  const [pending] = await db.select({ order: orders, link: waffoOrders }).from(orders)
    .innerJoin(waffoOrders, eq(orders.id, waffoOrders.orderId)).where(and(eq(orders.userId, subscription.userId), eq(orders.status, 'pending'),
      sql`${orders.metadata}->>'waffo_origin_subscription_id' = ${subscription.id}`))
  if (!pending?.link.remoteOrderId) throw new Error('app.payments.subscription.error.change')
  await waffoRequest('/v1/actions/subscription-order/cancel-order', { orderId: pending.link.remoteOrderId })
  await db.update(orders).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(orders.id, pending.order.id))
  await db.update(userSubscriptions).set({ scheduledPlanId: null, scheduledPlanName: null, scheduledCreditsPerPeriod: null,
    scheduledInterval: null, scheduledChangeAt: null, scheduledChangeType: null,
    cancelAtPeriodEnd: 1, cancelAt: subscription.currentPeriodEnd, updatedAt: new Date() }).where(eq(userSubscriptions.id, subscription.id))
  // Waffo cannot restore the origin after a confirmed change, even if the new order is canceled.
  return true
}
