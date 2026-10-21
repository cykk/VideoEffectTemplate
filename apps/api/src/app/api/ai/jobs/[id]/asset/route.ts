import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@markless/server/src/lib/auth/server'
import { getAiJob } from '@markless/server/src/lib/ai/jobs'
import { getPresignedUrl } from '@markless/server/src/lib/storage/r2-storage'

export const runtime = 'nodejs'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 })
  const { id } = await context.params
  const job = await getAiJob(session.user.id, id)
  const output = job?.output as { kind?: string; key?: string } | null
  if (job?.status !== 'succeeded' || output?.kind !== 'asset' || !output.key
    || !output.key.startsWith(`private/ai/${session.user.id}/${id}/`))
    return NextResponse.json({ ok: false }, { status: 404 })
  return NextResponse.redirect(await getPresignedUrl(output.key, 300))
}
