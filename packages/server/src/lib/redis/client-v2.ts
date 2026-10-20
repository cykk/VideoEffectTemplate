/**
 * Redis client and pub/sub helpers for user-scoped realtime events.
 */

import Redis from "ioredis";
import { getEnv } from "@markless/shared/src/lib/config/env";
import { buildRedisChannel } from "@markless/shared/src/lib/redis/namespace";

const REDIS_URL = getEnv("REDIS_URL");
const isBuildPhase =
  getEnv("NEXT_PHASE") === "phase-production-build" ||
  getEnv("NEXT_IS_EXPORT_WORKER") === "true";
const redisEnabled = Boolean(REDIS_URL) && !isBuildPhase;

const globalForRedis = globalThis as unknown as {
  redis: InstanceType<typeof Redis> | undefined;
};

export const redis = redisEnabled
  ? globalForRedis.redis ??
    new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      connectTimeout: 30000,
      commandTimeout: 5000,
      lazyConnect: true,
      enableReadyCheck: true,
      reconnectOnError: (err) => {
        console.error("[Redis] Connection error:", err.message);
        return true;
      },
    })
  : null;

if (getEnv("NODE_ENV") !== "production" && redis) {
  globalForRedis.redis = redis;
}

const globalForRedisEvents = globalThis as unknown as {
  redisEventListenersRegistered?: boolean;
};

if (redis && !globalForRedisEvents.redisEventListenersRegistered) {
  globalForRedisEvents.redisEventListenersRegistered = true;

  redis.on("ready", () => {
    console.log("[Redis Main] Ready");
  });

  redis.on("error", (err) => {
    console.error("[Redis Main] Error:", err.message);
  });
} else if (!redis && !isBuildPhase) {
  console.warn("[Redis] REDIS_URL not configured. Realtime features are disabled.");
}

export function isRedisAvailable(): boolean {
  return Boolean(redis && redis.status === "ready");
}

export async function ensureRedisConnected(): Promise<boolean> {
  if (!redis || isBuildPhase) return false;

  if (redis.status === "ready") return true;

  if (redis.status === "wait") {
    try {
      await redis.connect();
      return isRedisAvailable();
    } catch (error) {
      console.error("[Redis] Connect failed:", error);
      return false;
    }
  }

  return false;
}

/**
 * Gives an in-progress Redis connection a brief chance to recover before a
 * realtime event is dropped. Callers must still treat Redis as best effort.
 */
export async function ensureRedisReadyForPublish(waitMs: number = 1_000): Promise<boolean> {
  if (!redis || isBuildPhase) return false;

  if (redis.status === "ready") return true;

  if (redis.status === "wait") {
    void redis.connect().catch((error) => {
      console.error("[Redis] Connect failed while preparing publish:", error);
    });
  }

  if (redis.status !== "connecting" && redis.status !== "reconnecting" && redis.status !== "wait") {
    return false;
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (available: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      redis.off("ready", onReady);
      resolve(available);
    };
    const onReady = () => finish(true);
    const timeout = setTimeout(() => finish(isRedisAvailable()), waitMs);

    redis.once("ready", onReady);

    if (isRedisAvailable()) {
      finish(true);
    }
  });
}

export async function healthCheck(): Promise<boolean> {
  if (!redis || isBuildPhase) return false;
  try {
    if (!(await ensureRedisConnected())) return false;
    return (await redis.ping()) === "PONG";
  } catch (error) {
    console.error("[Redis] Health check failed:", error);
    return false;
  }
}

export interface StreamEventMessage {
  eventId: string;
  userId: string;
  type: string;
  status?: string;
  payload?: Record<string, unknown>;
  timestamp: string;
}

export async function pushUserEvent(
  eventId: string,
  userId: string,
  data: Omit<StreamEventMessage, "eventId" | "userId" | "timestamp">
): Promise<void> {
  if (!redis || !(await ensureRedisConnected())) {
    console.warn("[Redis] Client not ready, skipping publish");
    return;
  }

  try {
    const message: StreamEventMessage = {
      eventId,
      userId,
      ...data,
      timestamp: new Date().toISOString(),
    };

    const channel = buildRedisChannel("event", "user", userId, eventId);
    const subscribers = await redis.publish(channel, JSON.stringify(message));

    console.log(`[Redis Pub/Sub] Published to ${channel} (${subscribers} subscribers)`);
  } catch (error) {
    console.error("[Redis Pub/Sub] Publish failed:", error);
  }
}

export function createSubscriber(connectionId?: string): Redis {
  if (!REDIS_URL) {
    throw new Error("Redis is not configured");
  }

  const logPrefix = connectionId ? `[Redis Pool ${connectionId}]` : "[Redis Subscriber]";

  const subscriber = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    lazyConnect: false,
    showFriendlyErrorStack: getEnv("NODE_ENV") === "development",
  });

  subscriber.on("ready", () => {
    console.log(`${logPrefix} Ready`);
  });

  subscriber.on("error", (err) => {
    console.error(`${logPrefix} Error:`, err.message);
  });

  return subscriber;
}

export async function closeRedis(): Promise<void> {
  if (!redis) return;
  try {
    await redis.quit();
    console.log("[Redis] Connection closed gracefully");
  } catch (error) {
    console.error("[Redis] Error closing connection:", error);
  }
}

const globalForSignals = globalThis as unknown as {
  redisSignalHandlersRegistered?: boolean;
};

if (typeof process !== "undefined" && !globalForSignals.redisSignalHandlersRegistered) {
  globalForSignals.redisSignalHandlersRegistered = true;

  process.on("SIGTERM", () => {
    console.log("[Redis] SIGTERM received, closing connections...");
    closeRedis();
  });

  process.on("SIGINT", () => {
    console.log("[Redis] SIGINT received, closing connections...");
    closeRedis();
  });
}

export async function acquireLock(key: string, ttl: number = 30): Promise<boolean> {
  if (!redis || !isRedisAvailable()) {
    console.warn("[Redis Lock] Redis not available, allowing operation (degraded mode)");
    return true;
  }

  try {
    const result = await redis.set(key, "1", "EX", ttl, "NX");
    return result === "OK";
  } catch (error) {
    console.error("[Redis Lock] Error acquiring lock:", error);
    return true;
  }
}

export async function releaseLock(key: string): Promise<void> {
  if (!redis || !isRedisAvailable()) {
    return;
  }

  try {
    await redis.del(key);
  } catch (error) {
    console.error("[Redis Lock] Error releasing lock:", error);
  }
}
