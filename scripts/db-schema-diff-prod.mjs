/**
 * 只读：对比 drizzle 最新 snapshot 与生产 PostgreSQL，不修改任何结构。
 * 用法: dotenv -e .env.api.production -- node scripts/db-schema-diff-prod.mjs
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const root = process.cwd();
const journalPath = path.join(root, "drizzle/meta/_journal.json");
const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
const lastTag = journal.entries[journal.entries.length - 1].tag;
function resolveSnapshotPath(tag) {
  const candidates = [
    path.join(root, `drizzle/meta/${tag}_snapshot.json`),
    path.join(root, `drizzle/meta/${tag.split("_")[0]}_snapshot.json`),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`找不到 migration ${tag} 对应的 snapshot`);
}
const snapshotPath = resolveSnapshotPath(lastTag);
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("缺少 DATABASE_URL");
  process.exit(1);
}

/** @type {Map<string, Set<string>>} */
const expectedTables = new Map();
for (const [qualified, table] of Object.entries(snapshot.tables)) {
  const name = table.name;
  const cols = new Set(Object.keys(table.columns));
  expectedTables.set(name, cols);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();

  const migrationsRes = await client.query(`
    SELECT id, hash, created_at
    FROM drizzle.__drizzle_migrations
    ORDER BY created_at ASC
  `).catch(async (err) => {
    if (err.code === "42P01") {
      return { rows: [], note: "schema drizzle 或表 __drizzle_migrations 不存在" };
    }
    throw err;
  });

  const colsRes = await client.query(`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);

  const tablesRes = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  /** @type {Map<string, Set<string>>} */
  const actualTables = new Map();
  for (const row of colsRes.rows) {
    const t = row.table_name;
    if (!actualTables.has(t)) actualTables.set(t, new Set());
    actualTables.get(t).add(row.column_name);
  }

  const missingTables = [];
  const extraTables = [];
  /** @type {{ table: string, column: string }[]} */
  const missingColumns = [];
  /** @type {{ table: string, column: string }[]} */
  const extraColumns = [];

  for (const [table, expectedCols] of expectedTables) {
    if (!actualTables.has(table)) {
      missingTables.push(table);
      continue;
    }
    const actualCols = actualTables.get(table);
    for (const col of expectedCols) {
      if (!actualCols.has(col)) {
        missingColumns.push({ table, column: col });
      }
    }
    for (const col of actualCols) {
      if (!expectedCols.has(col)) {
        extraColumns.push({ table, column: col });
      }
    }
  }

  for (const table of actualTables.keys()) {
    if (!expectedTables.has(table)) {
      extraTables.push(table);
    }
  }

  // migration journal vs DB
  const migrationEntries = journal.entries.map((e) => ({
    tag: e.tag,
    when: e.when,
  }));

  console.log(JSON.stringify({
    snapshotTag: lastTag,
    drizzleMigrations: migrationsRes.rows ?? [],
    drizzleMigrationsNote: migrationsRes.note ?? null,
    migrationJournalCount: migrationEntries.length,
    summary: {
      missingTables: missingTables.length,
      extraTables: extraTables.length,
      missingColumns: missingColumns.length,
      extraColumns: extraColumns.length,
    },
    missingTables,
    extraTables,
    missingColumns,
    extraColumns,
    migrationJournalTags: migrationEntries.map((e) => e.tag),
  }, null, 2));

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
