import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@markless/server/src/lib/admin/require-admin-session'
import { db } from '@markless/server/src/lib/db/client'
import { waffoEvents, waffoOrders, waffoPayments, waffoRefunds } from '@markless/server/src/lib/db/schema/waffo'
import { waffoRequest } from '@markless/server/src/lib/payments/providers/waffo/client'
import { getWaffoSettings } from '@markless/server/src/lib/payments/providers/waffo/config'
import { moneyUnits } from '@markless/server/src/lib/payments/providers/waffo/events'
import { runWaffoOperations } from '@markless/server/src/lib/payments/providers/waffo/operations'

export const runtime = 'nodejs'
export async function GET(request: NextRequest) {
  if (!await requireAdminSession(request.headers)) return NextResponse.json({ ok: false }, { status: 401 })
  const config = getWaffoSettings()
  const [events, refunds, reviews] = await Promise.all([
    db.select({ id: waffoEvents.id, type: waffoEvents.eventType, status: waffoEvents.status, attempts: waffoEvents.attempts, error: waffoEvents.error, createdAt: waffoEvents.createdAt })
      .from(waffoEvents).where(and(eq(waffoEvents.mode, config.mode), eq(waffoEvents.storeId, config.storeId), inArray(waffoEvents.status, ['failed', 'pending']))).orderBy(desc(waffoEvents.createdAt)).limit(100),
    db.select({ id: waffoRefunds.id, orderId: waffoRefunds.orderId, amount: waffoRefunds.amount, currency: waffoRefunds.currency, status: waffoRefunds.status, creditStatus: waffoRefunds.creditStatus, reviewNote: waffoRefunds.reviewNote })
      .from(waffoRefunds).where(and(eq(waffoRefunds.mode, config.mode), eq(waffoRefunds.storeId, config.storeId))).orderBy(desc(waffoRefunds.createdAt)).limit(100),
    db.select().from(waffoOrders).where(and(eq(waffoOrders.mode, config.mode), eq(waffoOrders.storeId, config.storeId), isNotNull(waffoOrders.reviewReason))).orderBy(desc(waffoOrders.updatedAt)).limit(100),
  ])
  return NextResponse.json({ ok: true, data: { events, refunds, reviews: reviews.filter(item => item.reviewReason) } })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminSession(request.headers)
  if (!admin) return NextResponse.json({ ok: false }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ ok: false }, { status: 400 })
  const config = getWaffoSettings()
  if (body.action === 'run') return NextResponse.json({ ok: true, data: await runWaffoOperations() })
  if (body.action === 'replay' && typeof body.id === 'string') {
    await db.update(waffoEvents).set({ status: 'pending', attempts: 0, error: null, nextAttemptAt: new Date() }).where(and(
      eq(waffoEvents.id, body.id), eq(waffoEvents.mode, config.mode), eq(waffoEvents.storeId, config.storeId), eq(waffoEvents.status, 'failed')))
    return NextResponse.json({ ok: true })
  }
  if (body.action === 'resolve-refund' && typeof body.id === 'string' && typeof body.note === 'string' && body.note.trim()) {
    // This action records a decision, not an implicit balance deduction. Any manual
    // adjustment must first be made through the existing audited credit admin flow.
    await db.transaction(async tx => {
      const [resolved] = await tx.update(waffoRefunds).set({ creditStatus: 'resolved', reviewNote: body.note.trim().slice(0, 2000),
        reviewedBy: admin.user.id, updatedAt: new Date() }).where(and(eq(waffoRefunds.id, body.id), eq(waffoRefunds.mode, config.mode), eq(waffoRefunds.storeId, config.storeId))).returning()
      if (resolved) {
        const [remaining] = await tx.select().from(waffoRefunds).where(and(eq(waffoRefunds.orderId, resolved.orderId), eq(waffoRefunds.creditStatus, 'review')))
        if (!remaining) await tx.update(waffoOrders).set({ reviewReason: null }).where(and(eq(waffoOrders.orderId, resolved.orderId), eq(waffoOrders.reviewReason, 'refund_credit_review')))
      }
    })
    return NextResponse.json({ ok: true })
  }
  if (body.action === 'request-refund' && typeof body.paymentId === 'string' && typeof body.amount === 'string' && typeof body.reason === 'string' && body.reason.trim()) {
    if (!/^\d+(\.\d{1,4})?$/.test(body.amount)) return NextResponse.json({ ok: false }, { status: 400 })
    const [payment] = await db.select().from(waffoPayments).where(and(eq(waffoPayments.paymentId, body.paymentId), eq(waffoPayments.mode, config.mode), eq(waffoPayments.storeId, config.storeId)))
    if (!payment || !payment.charged || moneyUnits(body.amount) <= BigInt(0) || moneyUnits(body.amount) > moneyUnits(payment.charged)) return NextResponse.json({ ok: false }, { status: 400 })
    const id = nanoid()
    const reserved = await db.transaction(async tx => {
      await tx.select().from(waffoPayments).where(eq(waffoPayments.id, payment.id)).for('update')
      const existing = await tx.select().from(waffoRefunds).where(and(eq(waffoRefunds.paymentId, payment.paymentId),
        eq(waffoRefunds.mode, config.mode), eq(waffoRefunds.storeId, config.storeId)))
      if (existing.some(refund => ['requesting', 'processing', 'unknown'].includes(refund.status))) return false
      const refunded = existing.filter(refund => refund.status === 'succeeded').reduce((sum, refund) => sum + moneyUnits(refund.amount), BigInt(0))
      if (refunded + moneyUnits(body.amount) > moneyUnits(payment.charged)) return false
      await tx.insert(waffoRefunds).values({ id, refundId: `request:${id}`, orderId: payment.orderId, paymentId: payment.paymentId,
        mode: config.mode, storeId: config.storeId, amount: body.amount, currency: payment.currency, status: 'requesting', creditStatus: 'not_required',
        reviewedBy: admin.user.id, payload: { reason: body.reason.trim().slice(0, 2000) } })
      return true
    })
    if (!reserved) return NextResponse.json({ ok: false, error: 'A refund already exists; reconcile before retrying.' }, { status: 409 })
    try {
      const result = await waffoRequest<{ ticket: { id: string; status: string } }>('/v1/actions/refund-ticket/create-ticket', {
        paymentId: payment.paymentId, reason: body.reason.trim().slice(0, 2000), requestedAmount: { amount: body.amount, currency: payment.currency }, refundTicketMerchantExternalId: id,
      })
      await db.update(waffoRefunds).set({ status: 'processing', payload: { ticketId: result.ticket.id }, updatedAt: new Date() }).where(and(eq(waffoRefunds.id, id), eq(waffoRefunds.status, 'requesting')))
      return NextResponse.json({ ok: true })
    } catch {
      await db.update(waffoRefunds).set({ status: 'unknown', creditStatus: 'review', reviewNote: 'Remote result unknown. Reconcile ticket before retrying.', updatedAt: new Date() }).where(and(eq(waffoRefunds.id, id), eq(waffoRefunds.status, 'requesting')))
      return NextResponse.json({ ok: false, error: 'Refund response unknown; inspect the remote ticket.' }, { status: 502 })
    }
  }
  return NextResponse.json({ ok: false }, { status: 400 })
}
