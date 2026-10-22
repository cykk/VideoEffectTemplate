import { NextRequest, NextResponse } from 'next/server'
import { resolveAiUploadKey } from '@markless/server/src/lib/ai/uploads'
import { getPresignedUrl } from '@markless/server/src/lib/storage/r2-storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 用上传令牌换取短时效缩略图地址，用于登录或支付回跳后恢复已选照片的预览。 */
export async function GET(request: NextRequest) {
  const key = resolveAiUploadKey(request.nextUrl.searchParams.get('token'))
  if (!key) return NextResponse.json({ ok: false }, { status: 404 })
  try {
    return NextResponse.redirect(await getPresignedUrl(key, 300), {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch {
    return NextResponse.json({ ok: false }, { status: 404 })
  }
}
