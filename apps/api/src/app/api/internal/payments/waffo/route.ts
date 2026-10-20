import { NextRequest, NextResponse } from 'next/server'
import { getEnv } from '@markless/shared/src/lib/config/env'
import { runWaffoOperations } from '@markless/server/src/lib/payments/providers/waffo/operations'

export const runtime = 'nodejs'
export async function POST(request: NextRequest) {
  const secret = getEnv('CRON_SECRET')
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 })
  return NextResponse.json({ ok: true, data: await runWaffoOperations() })
}
