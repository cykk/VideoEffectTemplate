import pg from "pg";

const target = process.argv[2];
if (!['starter', 'upgrade'].includes(target)) {
  console.error('Usage: check-database-target.mjs starter|upgrade');
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error('[migration-check] DATABASE_URL is required');
  process.exit(2);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  const result = await client.query("select tablename from pg_tables where schemaname = 'public'");
  const tables = new Set(result.rows.map(row => row.tablename));
  const migrationTable = await client.query("select to_regclass('drizzle.__drizzle_migrations') as name");
  const hasMigrationHistory = Boolean(migrationTable.rows[0]?.name);
  if (target === 'starter' && tables.size > 0) {
    if (!tables.has('users') || !tables.has('ai_jobs') || tables.has('transcription_jobs') || !hasMigrationHistory) {
      throw new Error('Starter baseline requires an empty schema or an existing starter migration');
    }
  } else if (target === 'starter' && hasMigrationHistory) {
    throw new Error('Empty public schema has unrelated migration history');
  }
  if (target === 'upgrade' && (!tables.has('users') || !tables.has('transcription_jobs') || !hasMigrationHistory)) {
    throw new Error('Historical upgrade requires the existing transcription database');
  }
  console.log(`[migration-check] ${target} target verified`);
} catch (error) {
  console.error(`[migration-check] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
