const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { testDatabase, mocks } = require('../payments/support.cjs');

process.env.REPLICATE_ENABLED = 'true';
process.env.REPLICATE_API_TOKEN = 'test-token';
process.env.REPLICATE_WEBHOOK_SECRET = 'test-secret';
process.env.AI_FEATURES = JSON.stringify({ image: { version: 'a'.repeat(64), credits: 25 } });
process.env.NEXT_PUBLIC_APP_URL = 'https://api.example.com';

let db, pg, schema, jobs;
let requestPrediction = async () => ({ id: 'pred-123', status: 'starting' });
before(async () => {
  ({ db, pg, schema } = await testDatabase());
  mocks.set('@markless/server/src/lib/replicate/request', {
    requestReplicatePrediction: (...args) => requestPrediction(...args),
    getReplicatePrediction: async () => { throw new Error('Unexpected prediction lookup'); },
  });
  mocks.set('@markless/server/src/lib/ai/output', {
    persistAiOutput: async (_userId, _jobId, output) => ({ kind: 'json', value: output }),
  });
  jobs = require('../../packages/server/src/lib/ai/jobs.ts');
});
after(async () => { await pg?.close(); });
beforeEach(async () => {
  requestPrediction = async () => ({ id: 'pred-123', status: 'starting' });
  await pg.exec('TRUNCATE users CASCADE;');
  await db.insert(schema.users).values({ id: 'user', email: 'ai@example.com' });
  await db.insert(schema.userCredits).values({ userId: 'user', purchasedCredits: 100, totalBalance: 100 });
});

async function account() {
  return (await db.select().from(schema.userCredits))[0];
}

test('same request reserves once and records one debit', async () => {
  const first = await jobs.reserveAiJob('user', 'request-123456', 'image', { prompt: 'A house' });
  const second = await jobs.reserveAiJob('user', 'request-123456', 'image', { prompt: 'A house' });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.job.id, first.job.id);
  assert.equal((await account()).totalBalance, 75);
  assert.equal((await db.select().from(schema.creditTransactions)).length, 1);
});

test('failure releases a reservation once', async () => {
  const { job } = await jobs.reserveAiJob('user', 'request-123456', 'image', { prompt: 'A house' });
  await jobs.releaseAiJob(job.id, 'failed');
  await jobs.releaseAiJob(job.id, 'failed');
  assert.equal((await account()).totalBalance, 100);
  assert.equal((await db.select().from(schema.creditTransactions)).length, 2);
});

test('duplicate success and mismatched prediction do not change the balance', async () => {
  const { job } = await jobs.reserveAiJob('user', 'request-123456', 'image', { prompt: 'A house' });
  const prediction = { id: 'pred-123', status: 'succeeded', output: { result: 'ready' } };
  await jobs.completeAiJob(job.id, prediction);
  await jobs.completeAiJob(job.id, prediction);
  assert.equal((await account()).totalBalance, 75);
  assert.equal((await db.select().from(schema.creditTransactions)).length, 1);
  const stored = await jobs.getAiJob('user', job.id);
  assert.equal(stored.status, 'succeeded');
  assert.equal(stored.predictionId, 'pred-123');
  assert.equal(await jobs.getAiJob('another-user', job.id), null);
});

test('wrong prediction cannot complete or release a bound job', async () => {
  const { job } = await jobs.reserveAiJob('user', 'request-123456', 'image', { prompt: 'A house' });
  await db.update(schema.aiJobs).set({ predictionId: 'pred-123' });
  await assert.rejects(jobs.completeAiJob(job.id, { id: 'pred-other', status: 'failed' }), /mismatch/);
  assert.equal((await account()).totalBalance, 75);
  assert.equal((await jobs.getAiJob('user', job.id)).status, 'reserved');
});

test('definitive Replicate rejection releases credits', async () => {
  requestPrediction = async () => { throw Object.assign(new Error('Rejected'), { status: 422 }); };
  await assert.rejects(jobs.submitAiJob('user', 'request-123456', 'image', 'A house'), /unavailable/);
  assert.equal((await account()).totalBalance, 100);
  assert.equal((await db.select().from(schema.aiJobs))[0].status, 'failed');
});

test('ambiguous submission keeps one reservation and accepts a late callback', async () => {
  requestPrediction = async () => { throw new Error('Connection reset'); };
  await assert.rejects(jobs.submitAiJob('user', 'request-123456', 'image', 'A house'), /pending/);
  const unknown = (await db.select().from(schema.aiJobs))[0];
  assert.equal(unknown.status, 'unknown');
  assert.equal((await account()).totalBalance, 75);
  await jobs.submitAiJob('user', 'request-123456', 'image', 'A house');
  assert.equal((await db.select().from(schema.aiJobs)).length, 1);
  await jobs.completeAiJob(unknown.id, { id: 'pred-late', status: 'succeeded', output: 'ok' });
  assert.equal((await jobs.getAiJob('user', unknown.id)).status, 'succeeded');
  assert.equal((await account()).totalBalance, 75);
});

test('stale reservation is surfaced for review without releasing credits', async () => {
  const { job } = await jobs.reserveAiJob('user', 'request-123456', 'image', { prompt: 'A house' });
  const { eq } = require('drizzle-orm');
  await db.update(schema.aiJobs).set({ updatedAt: new Date(Date.now() - 11 * 60000) })
    .where(eq(schema.aiJobs.id, job.id));
  const result = await jobs.reconcileAiJobs();
  assert.equal(result.unresolved, 1);
  assert.equal((await jobs.getAiJob('user', job.id)).status, 'unknown');
  assert.equal((await account()).totalBalance, 75);
});

test('manual no-prediction decision requires age and records admin evidence', async () => {
  const { job } = await jobs.reserveAiJob('user', 'request-123456', 'image', { prompt: 'A house' });
  const review = { adminId: 'admin-1', evidence: 'Replicate dashboard has no matching prediction.' };
  await assert.rejects(jobs.releaseAiJob(job.id, 'manual_no_prediction', review), /eligible/);
  const { eq } = require('drizzle-orm');
  await db.update(schema.aiJobs).set({ createdAt: new Date(Date.now() - 11 * 60000) })
    .where(eq(schema.aiJobs.id, job.id));
  await jobs.releaseAiJob(job.id, 'manual_no_prediction', review);
  assert.equal((await account()).totalBalance, 100);
  const transactions = await db.select().from(schema.creditTransactions);
  assert.equal(transactions[1].metadata.review.adminId, review.adminId);
  assert.equal(transactions[1].metadata.review.evidence, review.evidence);
  await assert.rejects(jobs.releaseAiJob(job.id, 'manual_no_prediction', review), /settled/);
});

test('disabling new AI jobs does not stop review of existing reservations', async () => {
  const { job } = await jobs.reserveAiJob('user', 'request-123456', 'image', { prompt: 'A house' });
  const { eq } = require('drizzle-orm');
  await db.update(schema.aiJobs).set({ updatedAt: new Date(Date.now() - 11 * 60000) })
    .where(eq(schema.aiJobs.id, job.id));
  process.env.REPLICATE_ENABLED = 'false';
  try {
    const result = await jobs.reconcileAiJobs();
    assert.equal(result.unresolved, 1);
    assert.equal((await jobs.getAiJob('user', job.id)).status, 'unknown');
  } finally {
    process.env.REPLICATE_ENABLED = 'true';
  }
});
