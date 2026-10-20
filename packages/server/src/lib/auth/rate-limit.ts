/**
 * Rate Limiting for Magic Link Authentication
 * 
 * Prevents abuse by limiting magic link requests per email address.
 * Uses Redis with sliding window algorithm.
 * 
 * Strategy: 5 requests per hour (industry standard)
 */

import { createHash } from "node:crypto";
import { redis, isRedisAvailable } from '@markless/server/src/lib/redis/client-v2';
import { buildRedisKey } from "@markless/shared/src/lib/redis/namespace";

// Configuration
const RATE_LIMIT_WINDOW = 3600; // 1 hour in seconds
const RATE_LIMIT_MAX_REQUESTS = 5;

/**
 * Rate limit result
 */
export interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number; // Unix timestamp when the limit resets
}

/**
 * Check if email has exceeded rate limit for magic link requests
 * 
 * Uses Redis sorted set with sliding window algorithm:
 * - Key: {prefix}:auth:magic-link:rate-limit:{emailHash}
 * - Score: timestamp
 * - Member: unique request ID
 * 
 * @param email - Email address to check
 * @returns Rate limit result
 */
export async function checkMagicLinkRateLimit(email: string): Promise<RateLimitResult> {
    // If Redis is not available, allow the request (degraded mode)
    if (!isRedisAvailable()) {
        console.warn('[Rate Limit] Redis not available, allowing request (degraded mode)');
        return {
            success: true,
            limit: RATE_LIMIT_MAX_REQUESTS,
            remaining: RATE_LIMIT_MAX_REQUESTS - 1,
            reset: Date.now() + RATE_LIMIT_WINDOW * 1000,
        };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailHash = createHash("sha256").update(normalizedEmail).digest("hex");
    const key = buildRedisKey("auth", "magic-link", "rate-limit", emailHash);
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW * 1000;

    try {
        // Remove expired entries (outside the sliding window)
        await redis.zremrangebyscore(key, 0, windowStart);

        // Count requests in current window
        const requestCount = await redis.zcard(key);

        // Check if limit exceeded
        if (requestCount >= RATE_LIMIT_MAX_REQUESTS) {
            // Get the oldest request timestamp to calculate reset time
            const oldestRequests = await redis.zrange(key, 0, 0, 'WITHSCORES');
            const oldestTimestamp = oldestRequests.length > 1 ? parseInt(oldestRequests[1]) : now;
            const resetTime = oldestTimestamp + RATE_LIMIT_WINDOW * 1000;

            console.warn(`[Rate Limit] ⛔ Limit exceeded for ${email}: ${requestCount}/${RATE_LIMIT_MAX_REQUESTS}`);

            return {
                success: false,
                limit: RATE_LIMIT_MAX_REQUESTS,
                remaining: 0,
                reset: resetTime,
            };
        }

        // Add current request
        const requestId = `${now}-${Math.random().toString(36).substring(7)}`;
        await redis.zadd(key, now, requestId);

        // Set expiration on the key (cleanup)
        await redis.expire(key, RATE_LIMIT_WINDOW);

        const remaining = RATE_LIMIT_MAX_REQUESTS - requestCount - 1;

        console.log(`[Rate Limit] ✅ Allowed for ${email}: ${requestCount + 1}/${RATE_LIMIT_MAX_REQUESTS} (${remaining} remaining)`);

        return {
            success: true,
            limit: RATE_LIMIT_MAX_REQUESTS,
            remaining,
            reset: now + RATE_LIMIT_WINDOW * 1000,
        };
    } catch (error) {
        console.error('[Rate Limit] ❌ Error checking rate limit:', error);
        // On error, allow the request (fail open to avoid blocking legitimate users)
        return {
            success: true,
            limit: RATE_LIMIT_MAX_REQUESTS,
            remaining: RATE_LIMIT_MAX_REQUESTS - 1,
            reset: Date.now() + RATE_LIMIT_WINDOW * 1000,
        };
    }
}

/**
 * Format remaining time until rate limit reset
 * 
 * @param resetTimestamp - Unix timestamp when limit resets
 * @returns Human-readable time string
 */
export function formatResetTime(resetTimestamp: number): string {
    const now = Date.now();
    const diff = resetTimestamp - now;

    if (diff <= 0) {
        return 'now';
    }

    const minutes = Math.ceil(diff / 60000);

    if (minutes < 60) {
        return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }

    const hours = Math.ceil(minutes / 60);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
}
