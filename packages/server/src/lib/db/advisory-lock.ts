/**
 * PostgreSQL Advisory Lock Utilities
 *
 * Provides distributed locking mechanism using PostgreSQL advisory locks.
 * These locks are session-scoped and automatically released on connection close.
 *
 * Use case: Prevent concurrent execution of long-running operations (e.g., video migration)
 */

import { db } from './client';
import { sql } from 'drizzle-orm';

/**
 * Generate a numeric lock ID from a string key
 * PostgreSQL advisory locks require a bigint (int8)
 */
function stringToLockId(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Acquire a PostgreSQL advisory lock (non-blocking)
 *
 * @param key - Unique identifier for the lock (e.g., "migration:taskId")
 * @returns true if lock acquired, false if already held by another session
 */
export async function tryAcquireAdvisoryLock(key: string): Promise<boolean> {
  const lockId = stringToLockId(key);

  try {
    const result = await db.execute(
      sql`SELECT pg_try_advisory_lock(${lockId}) as acquired`
    );

    const acquired = result.rows[0]?.acquired;

    if (acquired) {
      console.log(`[AdvisoryLock] ✅ Acquired lock: ${key} (id: ${lockId})`);
    } else {
      console.log(`[AdvisoryLock] ⏭️ Lock already held: ${key} (id: ${lockId})`);
    }

    return !!acquired;
  } catch (error) {
    console.error(`[AdvisoryLock] ❌ Failed to acquire lock ${key}:`, error);
    return false;
  }
}

/**
 * Acquire a PostgreSQL advisory lock (blocking)
 * Waits until the lock is available
 *
 * @param key - Unique identifier for the lock
 */
export async function acquireAdvisoryLock(key: string): Promise<void> {
  const lockId = stringToLockId(key);

  try {
    await db.execute(sql`SELECT pg_advisory_lock(${lockId})`);
    console.log(`[AdvisoryLock] ✅ Acquired lock (blocking): ${key} (id: ${lockId})`);
  } catch (error) {
    console.error(`[AdvisoryLock] ❌ Failed to acquire blocking lock ${key}:`, error);
    throw error;
  }
}

/**
 * Release a PostgreSQL advisory lock
 *
 * @param key - Unique identifier for the lock
 * @returns true if lock was held and released, false if not held
 */
export async function releaseAdvisoryLock(key: string): Promise<boolean> {
  const lockId = stringToLockId(key);

  try {
    const result = await db.execute(
      sql`SELECT pg_advisory_unlock(${lockId}) as released`
    );

    const released = result.rows[0]?.released;

    if (released) {
      console.log(`[AdvisoryLock] ✅ Released lock: ${key} (id: ${lockId})`);
    } else {
      console.warn(`[AdvisoryLock] ⚠️ Lock not held: ${key} (id: ${lockId})`);
    }

    return !!released;
  } catch (error) {
    console.error(`[AdvisoryLock] ❌ Failed to release lock ${key}:`, error);
    return false;
  }
}

/**
 * Execute a function with an advisory lock
 * Automatically releases the lock when done (even on error)
 *
 * @param key - Unique identifier for the lock
 * @param fn - Function to execute while holding the lock
 * @param options - Lock options
 * @returns Result of the function
 */
export async function withAdvisoryLock<T>(
  key: string,
  fn: () => Promise<T>,
  options: {
    blocking?: boolean;
    onLockFailed?: () => T | Promise<T>;
  } = {}
): Promise<T> {
  const { blocking = false, onLockFailed } = options;

  let lockAcquired = false;

  try {
    // Try to acquire lock
    if (blocking) {
      await acquireAdvisoryLock(key);
      lockAcquired = true;
    } else {
      lockAcquired = await tryAcquireAdvisoryLock(key);

      if (!lockAcquired) {
        if (onLockFailed) {
          return await onLockFailed();
        }
        throw new Error(`Failed to acquire advisory lock: ${key}`);
      }
    }

    // Execute function
    return await fn();

  } finally {
    // Always release lock if acquired
    if (lockAcquired) {
      await releaseAdvisoryLock(key);
    }
  }
}

/**
 * Check if an advisory lock is currently held
 *
 * @param key - Unique identifier for the lock
 * @returns true if lock is held by any session
 */
export async function isAdvisoryLockHeld(key: string): Promise<boolean> {
  const lockId = stringToLockId(key);

  try {
    // Query pg_locks to see if this advisory lock exists
    const result = await db.execute(
      sql`
        SELECT COUNT(*) as count
        FROM pg_locks
        WHERE locktype = 'advisory'
        AND objid = ${lockId}
      `
    );

    const count = parseInt(String(result.rows[0]?.count || '0'));
    return count > 0;
  } catch (error) {
    console.error(`[AdvisoryLock] Failed to check lock status ${key}:`, error);
    return false;
  }
}
