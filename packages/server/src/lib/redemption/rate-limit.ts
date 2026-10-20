import { redis, isRedisAvailable } from "@markless/server/src/lib/redis/client-v2";
import { buildRedisKey } from "@markless/shared/src/lib/redis/namespace";

const RATE_LIMIT_WINDOW = 3600;
const RATE_LIMIT_MAX_ATTEMPTS = 20;

export interface RedemptionRateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

export async function checkRedemptionRateLimit(
  userId: string
): Promise<RedemptionRateLimitResult> {
  if (!isRedisAvailable()) {
    return {
      success: true,
      remaining: RATE_LIMIT_MAX_ATTEMPTS - 1,
      reset: Date.now() + RATE_LIMIT_WINDOW * 1000,
    };
  }

  const key = buildRedisKey("redemption", "rate-limit", userId);
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW * 1000;

  try {
    await redis.zremrangebyscore(key, 0, windowStart);
    const attemptCount = await redis.zcard(key);

    if (attemptCount >= RATE_LIMIT_MAX_ATTEMPTS) {
      const oldestRequests = await redis.zrange(key, 0, 0, "WITHSCORES");
      const oldestTimestamp =
        oldestRequests.length > 1 ? Number.parseInt(oldestRequests[1], 10) : now;

      return {
        success: false,
        remaining: 0,
        reset: oldestTimestamp + RATE_LIMIT_WINDOW * 1000,
      };
    }

    const attemptId = `${now}-${Math.random().toString(36).slice(2)}`;
    await redis.zadd(key, now, attemptId);
    await redis.expire(key, RATE_LIMIT_WINDOW);

    return {
      success: true,
      remaining: RATE_LIMIT_MAX_ATTEMPTS - attemptCount - 1,
      reset: now + RATE_LIMIT_WINDOW * 1000,
    };
  } catch (error) {
    console.error("[Redemption Rate Limit] Error:", error);
    return {
      success: true,
      remaining: RATE_LIMIT_MAX_ATTEMPTS - 1,
      reset: Date.now() + RATE_LIMIT_WINDOW * 1000,
    };
  }
}
