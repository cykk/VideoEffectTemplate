import { NextRequest, NextResponse } from 'next/server'
import { getEnv } from '@markless/shared/src/lib/config/env'
import { verifyReplicateWebhookSignature } from '@markless/server/src/lib/replicate/webhook'
import { completeAiJob, verifyAiWebhookToken } from '@markless/server/src/lib/ai/jobs'

export const runtime = 'nodejs'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const secret = getEnv('REPLICATE_WEBHOOK_SECRET')
  const raw = await request.text()
  if (!secret || !verifyAiWebhookToken(id, request.nextUrl.searchParams.get('token'))
    || !verifyReplicateWebhookSignature(request.headers, raw, secret).valid)
    return NextResponse.json({ ok: false }, { status: 403 })
  let payload: { id?: string; status?: string; output?: unknown; error?: string | null }
  try { payload = JSON.parse(raw) }
  catch { return NextResponse.json({ ok: false }, { status: 400 }) }
  if (!payload.id || !payload.status) return NextResponse.json({ ok: false }, { status: 400 })
  try {
    await completeAiJob(id, { id: payload.id, status: payload.status, output: payload.output, error: payload.error })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
