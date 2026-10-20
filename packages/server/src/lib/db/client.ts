import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

import { getEnv } from "@markless/shared/src/lib/config/env";
import { schema } from "./schema";

type DrizzleClient = NodePgDatabase<typeof schema>;

declare global {
  var __drizzleDb: DrizzleClient | undefined;
  var __pgPool: Pool | undefined;
  var __pgConnectionString: string | undefined;
  var __drizzleConnectionString: string | undefined;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getConnectionString(): string {
  const connectionString = getEnv("DATABASE_URL");
  if (!connectionString) {
    throw new Error(
      "Missing DATABASE_URL. Please configure a PostgreSQL connection string in the environment."
    );
  }

  return connectionString;
}

function collectErrorMessages(error: unknown, messages: Set<string>): void {
  if (!error) {
    return;
  }

  if (error instanceof Error) {
    if (error.message) {
      messages.add(error.message);
    }
    if ("cause" in error) {
      collectErrorMessages((error as Error & { cause?: unknown }).cause, messages);
    }
  }

  if (typeof error === "object" && error !== null) {
    const body = (error as { body?: unknown }).body;
    if (body && typeof body === "object") {
      const bodyMessage = (body as { message?: unknown }).message;
      if (typeof bodyMessage === "string") {
        messages.add(bodyMessage);
      }
    }
  }
}

export function isRetryableDatabaseConnectionError(error: unknown): boolean {
  const messages = new Set<string>();
  collectErrorMessages(error, messages);

  return [...messages].some((message) => {
    const normalized = message.toLowerCase();
    return (
      normalized.includes("connection terminated unexpectedly") ||
      normalized.includes("connection closed unexpectedly") ||
      normalized.includes("connection ended unexpectedly") ||
      normalized.includes("terminating connection") ||
      normalized.includes("client has encountered a connection error") ||
      normalized.includes("socket hang up") ||
      normalized.includes("read econreset")
    );
  });
}

function createPoolConfig(connectionString: string, isProduction: boolean): PoolConfig {
  const poolConfig: PoolConfig = {
    connectionString,
    max: parsePositiveInt(getEnv("DATABASE_POOL_MAX"), isProduction ? 10 : 4),
    idleTimeoutMillis: parsePositiveInt(getEnv("DATABASE_IDLE_TIMEOUT_MS"), 10000),
    connectionTimeoutMillis: parsePositiveInt(
      getEnv("DATABASE_CONNECTION_TIMEOUT_MS"),
      10000
    ),
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    maxLifetimeSeconds: parsePositiveInt(
      getEnv("DATABASE_MAX_LIFETIME_SECONDS"),
      isProduction ? 300 : 90
    ),
    allowExitOnIdle: !isProduction,
  };

  if (getEnv("DATABASE_SSL") === "true" || (isProduction && !poolConfig.ssl)) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  return poolConfig;
}

function getNodeEnv(): string {
  return getEnv("NODE_ENV") || "development";
}

function ensurePgPool(): Pool {
  const connectionString = getConnectionString();
  const isProduction = getNodeEnv() === "production";
  const needsReset =
    !globalThis.__pgPool || globalThis.__pgConnectionString !== connectionString;

  if (needsReset) {
    const previousPool = globalThis.__pgPool;
    const nextPool = new Pool(createPoolConfig(connectionString, isProduction));

    nextPool.on("error", (err) => {
      console.error("[DB Pool] Unexpected error on idle client:", err);
    });

    globalThis.__pgPool = nextPool;
    globalThis.__pgConnectionString = connectionString;
    globalThis.__drizzleDb = undefined;
    globalThis.__drizzleConnectionString = undefined;

    if (previousPool && previousPool !== nextPool) {
      previousPool
        .end()
        .catch((err) => console.error("[DB Pool] Failed to close previous pool:", err));
    }
  }

  return globalThis.__pgPool as Pool;
}

export function getDb(): DrizzleClient {
  const connectionString = getConnectionString();
  const pool = ensurePgPool();

  if (
    !globalThis.__drizzleDb ||
    globalThis.__drizzleConnectionString !== connectionString
  ) {
    globalThis.__drizzleDb = drizzle(pool, { schema });
    globalThis.__drizzleConnectionString = connectionString;
  }

  return globalThis.__drizzleDb;
}

export function getPgPool(): Pool {
  return ensurePgPool();
}

function createLazyProxy<T extends object>(factory: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      const instance = factory();
      const value = Reflect.get(instance as object, prop, receiver);
      return typeof value === "function" ? value.bind(instance) : value;
    },
  });
}

const db = createLazyProxy<DrizzleClient>(getDb);
const pgPool = createLazyProxy<Pool>(getPgPool);

export { db, pgPool };
export type { DrizzleClient };
