const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

test('new SaaS database contains core, billing and AI tables without transcription tables', async () => {
  const root = path.resolve(__dirname, '../..');
  const migrationDir = path.join(root, 'drizzle-starter');
  const sqlFile = fs.readdirSync(migrationDir).find(name => name.endsWith('.sql'));
  assert.ok(sqlFile);
  const pg = new PGlite();
  try {
    await pg.exec(fs.readFileSync(path.join(migrationDir, sqlFile), 'utf8'));
    const result = await pg.query("select tablename from pg_tables where schemaname = 'public'");
    const tables = new Set(result.rows.map(row => row.tablename));
    for (const table of ['users', 'orders', 'user_credits', 'user_subscriptions', 'waffo_orders', 'ai_jobs']) {
      assert.ok(tables.has(table), `${table} is missing`);
    }
    assert.equal([...tables].some(table => table.startsWith('transcription_')), false);
  } finally {
    await pg.close();
  }
});
