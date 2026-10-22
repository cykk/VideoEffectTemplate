import { createHmac, timingSafeEqual } from 'node:crypto'
import { nanoid } from 'nanoid'
import { getEnv } from '@markless/shared/src/lib/config/env'
import { uploadToR2 } from '@markless/server/src/lib/storage/r2-storage'

/**
 * 匿名可用的临时图片上传：用户在登录前就可以选图，服务端把图片放进 R2 临时区，
 * 返回一个带签名和有效期的令牌。登录、支付产生整页跳转后，只要带着令牌就能恢复选择。
 */
export const AI_UPLOAD_PREFIX = 'private/ai-uploads/'
export const AI_UPLOAD_MAX_BYTES = 8 * 1024 * 1024
/** 令牌有效期：用户需要在这段时间内完成登录和购买。 */
export const AI_UPLOAD_TTL_MS = 2 * 60 * 60 * 1000
/** 对象保留期：超过后由清理任务删除。 */
export const AI_UPLOAD_RETENTION_MS = 24 * 60 * 60 * 1000

const TOKEN_PATTERN = /^([A-Za-z0-9_-]{21})\.([0-9a-z]{6,12})\.([A-Za-z0-9_-]{22})$/

export type AiUploadImageType = 'image/jpeg' | 'image/png' | 'image/webp'

export function detectImageType(buffer: Buffer): AiUploadImageType | null {
  if (buffer.length < 12) return null
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  return null
}

function signingSecret(): string {
  const secret = getEnv('BETTER_AUTH_SECRET')
  if (!secret) throw new Error('Upload signing secret is not configured')
  return secret
}

function sign(id: string, expiresAt: string): string {
  return createHmac('sha256', signingSecret()).update(`ai-upload:${id}.${expiresAt}`)
    .digest().subarray(0, 16).toString('base64url')
}

export function aiUploadKey(id: string): string {
  return `${AI_UPLOAD_PREFIX}${id}`
}

export async function storeAiUpload(buffer: Buffer): Promise<{ token: string; expiresAt: number } | null> {
  const contentType = detectImageType(buffer)
  if (!contentType || buffer.length > AI_UPLOAD_MAX_BYTES) return null
  const id = nanoid(21)
  const expiresAt = Date.now() + AI_UPLOAD_TTL_MS
  const expiresAtText = expiresAt.toString(36)
  await uploadToR2(buffer, aiUploadKey(id), contentType)
  return { token: `${id}.${expiresAtText}.${sign(id, expiresAtText)}`, expiresAt }
}

/** 校验令牌并返回 R2 对象键；无效或过期时返回 null。 */
export function resolveAiUploadKey(token: unknown): string | null {
  if (typeof token !== 'string') return null
  const match = TOKEN_PATTERN.exec(token)
  if (!match) return null
  const [, id, expiresAtText, signature] = match
  const expiresAt = Number.parseInt(expiresAtText, 36)
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null
  try {
    const expected = Buffer.from(sign(id, expiresAtText), 'base64url')
    const actual = Buffer.from(signature, 'base64url')
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
  } catch { return null }
  return aiUploadKey(id)
}
