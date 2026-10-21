import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@markless/server/src/lib/admin/require-admin-session'
import { getAiJobsNeedingReview, releaseAiJob } from '@markless/server/src/lib/ai/jobs'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  if (!await requireAdminSession(request.headers)) return NextResponse.json({ ok: false }, { status: 401 })
  return NextResponse.json({ ok: true, jobs: await getAiJobsNeedingReview() })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminSession(request.headers)
  if (!admin) return NextResponse.json({ ok: false }, { status: 401 })
  const body = await request.json().catch(() => null) as {
    action?: unknown; id?: unknown; evidence?: unknown; confirmation?: unknown
  } | null
  if (body?.action !== 'confirm-no-prediction' || typeof body.id !== 'string'
    || !/^[A-Za-z0-9_-]{10,40}$/.test(body.id) || typeof body.evidence !== 'string'
    || body.evidence.trim().length < 20 || body.evidence.length > 1000
    || body.confirmation !== 'NO_REMOTE_PREDICTION') {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  try {
    const job = await releaseAiJob(body.id, 'manual_no_prediction', {
      adminId: admin.user.id, evidence: body.evidence.trim(),
    })
    if (!job) return NextResponse.json({ ok: false }, { status: 404 })
    return NextResponse.json({ ok: true, status: job.status })
  } catch {
    return NextResponse.json({ ok: false }, { status: 409 })
  }
}
