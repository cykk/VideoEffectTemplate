import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@markless/server/src/lib/auth/server'
import { getAiJob } from '@markless/server/src/lib/ai/jobs'

export const runtime = 'nodejs'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 })
  const { id } = await context.params
  const job = await getAiJob(session.user.id, id)
  return job ? NextResponse.json({ ok: true, job }) : NextResponse.json({ ok: false }, { status: 404 })
}
