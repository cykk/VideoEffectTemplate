import { NextRequest, NextResponse } from 'next/server'
import { getWaffoSettings } from '@markless/server/src/lib/payments/providers/waffo/config'
import { parseWaffoEvent, verifyWaffoSignature } from '@markless/server/src/lib/payments/providers/waffo/events'
import { receiveWaffoEvent } from '@markless/server/src/lib/payments/providers/waffo/processor'
import { tasks } from '@trigger.dev/sdk/v3'
import { getEnv } from '@markless/shared/src/lib/config/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const raw = await request.text()
  const config = getWaffoSettings()
  if (!config.publicKey || !verifyWaffoSignature(raw, request.headers.get('X-Waffo-Signature') || '', config.publicKey)) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  try {
    const event = parseWaffoEvent(raw)
    if (event.mode !== config.mode || event.storeId !== config.storeId) return NextResponse.json({ ok: false }, { status: 400 })
    await receiveWaffoEvent(event)
    if (getEnv('WAFFO_OPERATIONS_ENABLED') === 'true') {
      let timer: ReturnType<typeof setTimeout>
      try { await Promise.race([
        tasks.trigger('billing-process-waffo-inbox', {}, { idempotencyKey: `waffo:${event.mode}:${event.storeId}:${event.eventType}:${event.eventId}` }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Dispatch timeout')), 2500) }),
      ]) }
      catch { console.error('[Waffo] Immediate processing unavailable; durable event awaits scheduled worker') }
      finally { clearTimeout(timer) }
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Waffo] Cannot persist webhook', { error: error instanceof Error ? error.name : 'unknown' })
    // Do not acknowledge an event before the durable inbox commit.
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
