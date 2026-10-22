import { createHash } from 'node:crypto'
import { isRedisAvailable, redis } from '@markless/server/src/lib/redis/client-v2'
import { buildRedisKey } from '@markless/shared/src/lib/redis/namespace'

const WINDOW_SECONDS = 3600
const MAX_UPLOADS_PER_WINDOW = 30

/** 匿名上传按 IP 限流；Redis 不可用时放行（体积和类型校验仍然生效）。 */
export async function checkAiUploadRateLimit(ip: string): Promise<{ success: boolean; retryAfter: number }> {
  if (!redis || !isRedisAvailable()) return { success: true, retryAfter: 0 }
  const key = buildRedisKey('ai', 'upload', 'rate-limit', createHash('sha256').update(ip).digest('hex').slice(0, 32))
  try {
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, WINDOW_SECONDS)
    if (count > MAX_UPLOADS_PER_WINDOW) {
      const ttl = await redis.ttl(key)
      return { success: false, retryAfter: ttl > 0 ? ttl : WINDOW_SECONDS }
    }
    return { success: true, retryAfter: 0 }
  } catch (error) {
    console.error('[AI uploads] Rate limit check failed', error)
    return { success: true, retryAfter: 0 }
  }
}
