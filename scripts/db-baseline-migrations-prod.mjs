/**
 * 生产库：将 drizzle 迁移账本 baseline 到 idx 8（不执行业务 DDL，仅 INSERT 账本行）。
 * 用法: dotenv -e .env.api.production -- node scripts/db-baseline-migrations-prod.mjs
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const BASELINE_TAG = "20260904080422_mean_serpent_society";
const BASELINE_WHEN = 1788509062219;

const sqlPath = path.join(process.cwd(), `drizzle/${BASELINE_TAG}.sql`);
const hash = await import("node:crypto").then((c) =>
  c.createHash("sha256").update(fs.readFileSync(sqlPath, "utf8")).digest("hex")
);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("缺少 DATABASE_URL");
  process.exit(1);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  const col = await client.query(`
    SELECT 1 AS ok
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'transcription_jobs'
      AND column_name = 'requested_language'
    LIMIT 1
  `);

  if (col.rowCount > 0) {
    console.log("requested_language 已存在，无需再 migrate DDL。");
  }

  const existing = await client.query(
    `SELECT id, hash, created_at FROM drizzle.__drizzle_migrations WHERE created_at >= $1::bigint ORDER BY created_at DESC LIMIT 5`,
    [String(BASELINE_WHEN)]
  );

  if (existing.rowCount > 0 && Number(existing.rows[0].created_at) >= BASELINE_WHEN) {
    console.log("baseline 已存在（created_at >= idx 8），跳过 INSERT:", existing.rows[0]);
  } else {
    await client.query(
      `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
      [hash, String(BASELINE_WHEN)]
    );
    console.log("已写入 baseline:", { tag: BASELINE_TAG, when: BASELINE_WHEN, hash });
  }

  const ledger = await client.query(
    `SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at ASC`
  );
  console.log("当前迁移账本条数:", ledger.rowCount);
} finally {
  await client.end();
}
