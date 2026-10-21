import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@markless/server/src/lib/auth/server'
import { getAiJobByRequestKey, getAiJobs, submitAiJob } from '@markless/server/src/lib/ai/jobs'
import { listAiFeatures } from '@markless/server/src/lib/ai/features'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 })
  return NextResponse.json({ ok: true, jobs: await getAiJobs(session.user.id), features: listAiFeatures() })
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 })
  const body = await request.json().catch(() => null) as { requestKey?: unknown; featureKey?: unknown; prompt?: unknown } | null
  if (!body || typeof body.requestKey !== 'string' || typeof body.featureKey !== 'string' || typeof body.prompt !== 'string')
    return NextResponse.json({ ok: false, error: 'app.ai.jobs.error.invalid' }, { status: 400 })
  try {
    const job = await submitAiJob(session.user.id, body.requestKey, body.featureKey, body.prompt)
    return NextResponse.json({ ok: true, job })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const known = ['app.ai.jobs.error.unavailable', 'app.ai.jobs.error.invalid', 'app.ai.jobs.error.credits', 'app.ai.jobs.error.pending']
    if (message === 'app.ai.jobs.error.pending') {
      const job = await getAiJobByRequestKey(session.user.id, body.requestKey)
      if (job) return NextResponse.json({ ok: true, job }, { status: 202 })
    }
    return NextResponse.json({ ok: false, error: known.includes(message) ? message : 'app.ai.jobs.error.pending' },
      { status: message === known[2] ? 402 : message === known[1] ? 400 : message === known[0] ? 503 : 202 })
  }
}
