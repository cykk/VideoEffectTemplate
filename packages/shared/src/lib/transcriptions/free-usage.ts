import { createHash } from "crypto";
import {
  acquireLock,
  ensureRedisConnected,
  redis,
  releaseLock,
} from "@markless/server/src/lib/redis/client-v2";
import { FREE_TRANSCRIPTION_DAILY_LIMIT } from "@markless/shared/src/lib/transcriptions/free-usage-constants";
import { buildRedisKey } from "@markless/shared/src/lib/redis/namespace";

export { FREE_TRANSCRIPTION_DAILY_LIMIT } from "@markless/shared/src/lib/transcriptions/free-usage-constants";
export {
  DEFAULT_FREE_TRANSCRIPTION_DURATION_LIMIT_MINUTES,
  getFreeTranscriptionConfig,
  getFreeTranscriptionDurationLimitMinutes,
  getFreeTranscriptionDurationLimitMs,
  getFreeTranscriptionPublicConfig,
  type FreeTranscriptionPublicConfig,
  type FreeTranscriptionAccessMode,
  type FreeTranscriptionConfig,
} from "@markless/shared/src/lib/transcriptions/free-transcription-config";

type FreeUsageReservationInput = {
  userId?: string | null;
  anonymousSessionId?: string | null;
  publicId: string;
  now?: Date;
  dailyLimit: number;
};

type DailyUsageContext = {
  dateKey: string;
  expiresInSeconds: number;
  anonymousKey: string | null;
  userKey: string | null;
};

export type FreeUsageReservation = {
  reservationId: string;
  publicId: string;
  dateKey: string;
  anonymousKey: string | null;
  userKey: string | null;
};

export type FreeUsageAvailability = {
  allowed: boolean;
  used: number;
  rawUsed: number;
  limit: number;
  remaining: number;
};

function buildUtcDateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function getSecondsUntilNextUtcReset(now: Date): number {
  const nextUtcMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    2,
    0,
    0,
    0
  );
  return Math.max(60, Math.ceil((nextUtcMidnight - now.getTime()) / 1000));
}

function buildAnonymousUsageKey(anonymousSessionId: string, dateKey: string): string {
  return buildRedisKey("free", "daily", "anon", anonymousSessionId, dateKey);
}

function buildUserUsageKey(userId: string, dateKey: string): string {
  return buildRedisKey("free", "daily", "user", userId, dateKey);
}

function buildReservationId(input: FreeUsageReservationInput): string {
  const ownerSeed = `${input.userId ?? ""}:${input.anonymousSessionId ?? ""}:${input.publicId}`;
  const digest = createHash("sha256").update(ownerSeed).digest("hex").slice(0, 24);
  return `free-usage:${digest}`;
}

function buildUsageLockKey(context: DailyUsageContext): string {
  const identitySeed = `${context.userKey ?? ""}:${context.anonymousKey ?? ""}:${context.dateKey}`;
  const digest = createHash("sha256").update(identitySeed).digest("hex").slice(0, 24);
  return buildRedisKey("free", "daily", "lock", digest);
}

function buildDailyUsageContext(
  userId: string | null | undefined,
  anonymousSessionId: string | null | undefined,
  now: Date
): DailyUsageContext {
  const dateKey = buildUtcDateKey(now);
  return {
    dateKey,
    expiresInSeconds: getSecondsUntilNextUtcReset(now),
    anonymousKey: anonymousSessionId
      ? buildAnonymousUsageKey(anonymousSessionId, dateKey)
      : null,
    userKey: userId ? buildUserUsageKey(userId, dateKey) : null,
  };
}

async function readUsageCount(context: DailyUsageContext): Promise<number> {
  if (!redis || !(await ensureRedisConnected())) {
    throw new Error("Redis is unavailable for free transcription quota checks");
  }

  if (context.userKey && context.anonymousKey) {
    const members = await redis.sunion(context.userKey, context.anonymousKey);
    return members.length;
  }

  if (context.userKey) {
    return redis.scard(context.userKey);
  }

  if (context.anonymousKey) {
    return redis.scard(context.anonymousKey);
  }

  return 0;
}

export async function getFreeTranscriptionUsageAvailability(input: {
  userId?: string | null;
  anonymousSessionId?: string | null;
  now?: Date;
  dailyLimit: number;
}): Promise<FreeUsageAvailability> {
  const now = input.now ?? new Date();
  const context = buildDailyUsageContext(input.userId, input.anonymousSessionId, now);
  const rawUsed = await readUsageCount(context);
  const used = Math.min(rawUsed, input.dailyLimit);

  return {
    allowed: rawUsed < input.dailyLimit,
    used,
    rawUsed,
    limit: input.dailyLimit,
    remaining: Math.max(0, input.dailyLimit - rawUsed),
  };
}

export async function reserveFreeTranscriptionUsage(
  input: FreeUsageReservationInput
): Promise<FreeUsageReservation | null> {
  const now = input.now ?? new Date();
  const context = buildDailyUsageContext(input.userId, input.anonymousSessionId, now);
  const reservationId = buildReservationId(input);

  if (!redis || !(await ensureRedisConnected())) {
    throw new Error("Redis is unavailable for free transcription quota reservations");
  }

  const lockKey = buildUsageLockKey(context);
  const lockAcquired = await acquireLock(lockKey, 5);

  try {
    const used = await readUsageCount(context);
    if (used >= input.dailyLimit) {
      return null;
    }

    const multi = redis.multi();
    if (context.anonymousKey) {
      multi.sadd(context.anonymousKey, input.publicId);
      multi.expire(context.anonymousKey, context.expiresInSeconds);
    }
    if (context.userKey) {
      multi.sadd(context.userKey, input.publicId);
      multi.expire(context.userKey, context.expiresInSeconds);
    }
    multi.set(
      buildRedisKey("free", "daily", "reservation", reservationId),
      JSON.stringify({
        publicId: input.publicId,
        dateKey: context.dateKey,
        anonymousKey: context.anonymousKey,
        userKey: context.userKey,
      }),
      "EX",
      context.expiresInSeconds
    );

    await multi.exec();

    return {
      reservationId,
      publicId: input.publicId,
      dateKey: context.dateKey,
      anonymousKey: context.anonymousKey,
      userKey: context.userKey,
    };
  } finally {
    if (lockAcquired) {
      await releaseLock(lockKey);
    }
  }
}

export async function rollbackFreeTranscriptionUsageReservation(
  reservation: FreeUsageReservation
): Promise<void> {
  if (!redis || !(await ensureRedisConnected())) {
    return;
  }

  const multi = redis.multi();
  if (reservation.anonymousKey) {
    multi.srem(reservation.anonymousKey, reservation.publicId);
  }
  if (reservation.userKey) {
    multi.srem(reservation.userKey, reservation.publicId);
  }
  multi.del(buildRedisKey("free", "daily", "reservation", reservation.reservationId));
  await multi.exec();
}

export async function confirmFreeTranscriptionUsageReservation(
  reservation: FreeUsageReservation
): Promise<void> {
  if (!redis || !(await ensureRedisConnected())) {
    return;
  }

  await redis.del(buildRedisKey("free", "daily", "reservation", reservation.reservationId));
}
