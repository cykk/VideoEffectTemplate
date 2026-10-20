import { getPgPool } from "@markless/server/src/lib/db/client";
import { healthCheck as checkRedisHealth } from "@markless/server/src/lib/redis/client-v2";
import { checkR2Readiness } from "@markless/server/src/lib/storage/r2-storage";
import { getEnv } from "@markless/shared/src/lib/config/env";

const DATABASE_TIMEOUT_MS = 1_500;
const REDIS_TIMEOUT_MS = 1_500;
const R2_TIMEOUT_MS = 2_000;

export type ReadinessCheckName = "database" | "redis" | "r2";
export type ReadinessCheckStatus = "ok" | "failed" | "timeout";

export type ReadinessCheckResult = {
  name: ReadinessCheckName;
  status: ReadinessCheckStatus;
  durationMs: number;
};

export type ReadinessResult = {
  ready: boolean;
  durationMs: number;
  checks: ReadinessCheckResult[];
};

type CheckTask = (signal: AbortSignal) => Promise<void>;

async function runCheck(
  name: ReadinessCheckName,
  timeoutMs: number,
  task: CheckTask
): Promise<ReadinessCheckResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  let timedOut = false;

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    await Promise.race([
      task(controller.signal),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener(
          "abort",
          () => reject(new Error("Readiness check timed out")),
          { once: true }
        );
      }),
    ]);

    return { name, status: "ok", durationMs: Date.now() - startedAt };
  } catch {
    return {
      name,
      status: timedOut ? "timeout" : "failed",
      durationMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkDatabase(): Promise<void> {
  await getPgPool().query("SELECT 1");
}

async function checkRedis(): Promise<void> {
  if (!getEnv("REDIS_URL") || !(await checkRedisHealth())) {
    throw new Error("Redis is not ready");
  }
}

export async function getReadiness(): Promise<ReadinessResult> {
  const startedAt = Date.now();
  const checks = await Promise.all([
    runCheck("database", DATABASE_TIMEOUT_MS, () => checkDatabase()),
    runCheck("redis", REDIS_TIMEOUT_MS, () => checkRedis()),
    runCheck("r2", R2_TIMEOUT_MS, (signal) => checkR2Readiness(signal)),
  ]);

  return {
    ready: checks.every((check) => check.status === "ok"),
    durationMs: Date.now() - startedAt,
    checks,
  };
}
