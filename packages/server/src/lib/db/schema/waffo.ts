import { pgTable, text, timestamp, integer, jsonb, numeric, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { orders } from './orders'

/** Isolated, additive storage. Creem never reads or writes these tables. */
export const waffoEvents = pgTable('waffo_events', {
  id: text('id').primaryKey(),
  mode: text('mode').notNull(),
  storeId: text('store_id').notNull(),
  eventType: text('event_type').notNull(),
  eventId: text('event_id').notNull(),
  payload: jsonb('payload').notNull(),
  status: text('status').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
}, table => [uniqueIndex('waffo_events_identity').on(table.mode, table.storeId, table.eventType, table.eventId), index('waffo_events_pending').on(table.status, table.nextAttemptAt)])

export const waffoOrders = pgTable('waffo_orders', {
  orderId: text('order_id').primaryKey().references(() => orders.id),
  mode: text('mode').notNull(),
  storeId: text('store_id').notNull(),
  remoteOrderId: text('remote_order_id'),
  sessionId: text('session_id'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  fulfilledAt: timestamp('fulfilled_at', { withTimezone: true }),
  subscriptionId: text('subscription_id'),
  lastEventAt: timestamp('last_event_at', { withTimezone: true }),
  lastReconciledAt: timestamp('last_reconciled_at', { withTimezone: true }),
  reviewReason: text('review_reason'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex('waffo_orders_remote').on(table.mode, table.storeId, table.remoteOrderId),
  index('waffo_orders_reconcile').on(table.mode, table.storeId, table.lastReconciledAt),
  uniqueIndex('waffo_orders_subscription').on(table.subscriptionId)])

export const waffoPayments = pgTable('waffo_payments', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id),
  mode: text('mode').notNull(),
  storeId: text('store_id').notNull(),
  paymentId: text('payment_id').notNull(),
  remoteOrderId: text('remote_order_id').notNull(),
  currency: text('currency').notNull(),
  subtotal: numeric('subtotal', { precision: 18, scale: 4 }),
  tax: numeric('tax', { precision: 18, scale: 4 }),
  total: numeric('total', { precision: 18, scale: 4 }),
  charged: numeric('charged', { precision: 18, scale: 4 }),
  periodNumber: integer('period_number'),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex('waffo_payments_identity').on(table.mode, table.storeId, table.paymentId), index('waffo_payments_order').on(table.orderId)])

export const waffoRefunds = pgTable('waffo_refunds', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id),
  mode: text('mode').notNull(),
  storeId: text('store_id').notNull(),
  refundId: text('refund_id').notNull(),
  paymentId: text('payment_id').notNull(),
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  currency: text('currency').notNull(),
  status: text('status').notNull(),
  creditStatus: text('credit_status').notNull().default('review'),
  reviewNote: text('review_note'),
  reviewedBy: text('reviewed_by'),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex('waffo_refunds_identity').on(table.mode, table.storeId, table.refundId), index('waffo_refunds_order').on(table.orderId)])
