import { and, eq, inArray, gt, or, sql } from 'drizzle-orm'
import { db } from '@markless/server/src/lib/db/client'
import { orders, type NewOrder } from '@markless/server/src/lib/db/schema/orders'
import { userSubscriptions } from '@markless/server/src/lib/db/schema/subscriptions'
import { waffoOrders } from '@markless/server/src/lib/db/schema/waffo'
import { assertWaffoCheckoutReady } from './config'

export async function createWaffoOrder(input: NewOrder, originSubscriptionId?: string) {
  const config = assertWaffoCheckoutReady()
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.userId}))`)
    if (input.productType === 'subscription') {
      const active = await tx.select().from(userSubscriptions).where(and(eq(userSubscriptions.userId, input.userId), inArray(userSubscriptions.status, ['active', 'past_due', 'paused'])))
      const [pending] = await tx.select().from(orders).where(and(eq(orders.userId, input.userId), eq(orders.productType, 'subscription'), eq(orders.status, 'pending'), or(eq(orders.paymentProvider, 'waffo'), gt(orders.createdAt, new Date(Date.now() - 35 * 60000)))))
      if (active.some(subscription => subscription.id !== originSubscriptionId || subscription.provider !== 'waffo') || pending) throw new Error('app.payments.checkout.error.existingSubscription')
    }
    const [order] = await tx.insert(orders).values(input).returning()
    await tx.insert(waffoOrders).values({ orderId: order.id, mode: config.mode, storeId: config.storeId,
      expiresAt: new Date(Date.now() + 30 * 60000) })
    return order
  })
}
