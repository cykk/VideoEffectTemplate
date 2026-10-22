import { NextRequest, NextResponse } from 'next/server'
import { AI_UPLOAD_MAX_BYTES, storeAiUpload } from '@markless/server/src/lib/ai/uploads'
import { checkAiUploadRateLimit } from '@markless/server/src/lib/ai/upload-rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim() || 'unknown'
}

/**
 * 匿名可用：用户在登录前选图，图片先进入临时区，返回带签名的令牌。
 * 令牌只能引用这一个临时对象，提交任务时仍需要登录和足够积分。
 */
export async function POST(request: NextRequest) {
  const declaredLength = Number(request.headers.get('content-length') || 0)
  if (declaredLength > AI_UPLOAD_MAX_BYTES + 64 * 1024)
    return NextResponse.json({ ok: false, error: 'app.ai.uploads.error.tooLarge' }, { status: 413 })

  const limit = await checkAiUploadRateLimit(clientIp(request))
  if (!limit.success) {
    return NextResponse.json({ ok: false, error: 'app.ai.uploads.error.rateLimited' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } })
  }

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: 'app.ai.uploads.error.invalid' }, { status: 400 })
  if (file.size > AI_UPLOAD_MAX_BYTES) return NextResponse.json({ ok: false, error: 'app.ai.uploads.error.tooLarge' }, { status: 413 })

  try {
    const stored = await storeAiUpload(Buffer.from(await file.arrayBuffer()))
    if (!stored) return NextResponse.json({ ok: false, error: 'app.ai.uploads.error.invalid' }, { status: 400 })
    return NextResponse.json({ ok: true, token: stored.token, expiresAt: stored.expiresAt })
  } catch (error) {
    console.error('[AI uploads] Failed to store upload', error)
    return NextResponse.json({ ok: false, error: 'app.ai.uploads.error.unavailable' }, { status: 503 })
  }
}
