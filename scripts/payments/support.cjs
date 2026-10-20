const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const mocks = new Map();
const resolve = Module._resolveFilename;
const load = Module._load;
Module._resolveFilename = function (name, parent, ...rest) {
  if (name.startsWith('@markless/')) name = path.join(root, 'packages', name.slice('@markless/'.length));
  return resolve.call(this, name, parent, ...rest);
};
Module._load = function (name, parent, ...rest) {
  if (mocks.has(name)) return mocks.get(name);
  return load.call(this, name, parent, ...rest);
};
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, file);

async function testDatabase() {
  const { PGlite } = require('@electric-sql/pglite');
  const { drizzle } = require('drizzle-orm/pglite');
  const kit = require('drizzle-kit/api');
  const schema = require('../../packages/server/src/lib/db/schema/index.ts');
  const pg = new PGlite();
  const previous = JSON.parse(fs.readFileSync(path.join(root, 'drizzle/meta/20260917021114_snapshot.json'), 'utf8'));
  const current = JSON.parse(fs.readFileSync(path.join(root, 'drizzle/meta/20261021000000_snapshot.json'), 'utf8'));
  const drift = await kit.generateMigration(current, kit.generateDrizzleJson(schema));
  if (drift.length) throw new Error('Waffo migration snapshot does not match the current schema');
  const statements = await kit.generateMigration(kit.generateDrizzleJson({}), previous);
  await pg.exec(statements.join('\n'));
  await pg.exec(fs.readFileSync(path.join(root, 'drizzle/20261021000000_waffo_payments.sql'), 'utf8'));
  const db = drizzle(pg, { schema: schema.schema });
  mocks.set('@markless/server/src/lib/db/client', { db });
  return { db, pg, schema };
}

module.exports = { mocks, testDatabase, root };
