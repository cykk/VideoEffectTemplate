import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@markless/server/src/lib/auth/server'
import { getAiJob } from '@markless/server/src/lib/ai/jobs'
import { getPresignedDownloadUrl, getPresignedUrl } from '@markless/server/src/lib/storage/r2-storage'

export const runtime = 'nodejs'

/**
 * 默认：302 到短时效地址（兼容原有用法）。
 * ?format=json：返回 { url, contentType }，供页面内播放器使用。
 * ?download=1：302 到带 attachment 文件名的地址，供「保存」按钮使用。
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 })
  const { id } = await context.params
  const job = await getAiJob(session.user.id, id)
  const output = job?.output as { kind?: string; key?: string; contentType?: string } | null
  if (job?.status !== 'succeeded' || output?.kind !== 'asset' || !output.key
    || !output.key.startsWith(`private/ai/${session.user.id}/${id}/`))
    return NextResponse.json({ ok: false }, { status: 404 })

  const params = request.nextUrl.searchParams
  if (params.get('download') === '1') {
    const extension = output.key.split('.').at(-1) || 'mp4'
    return NextResponse.redirect(await getPresignedDownloadUrl(output.key, {
      filename: `${job.featureKey}-${id}.${extension}`, contentType: output.contentType, expiresIn: 300,
    }))
  }
  if (params.get('format') === 'json') {
    return NextResponse.json({ ok: true, url: await getPresignedUrl(output.key, 3600), contentType: output.contentType ?? null },
      { headers: { 'Cache-Control': 'private, no-store' } })
  }
  return NextResponse.redirect(await getPresignedUrl(output.key, 300))
}
