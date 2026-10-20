const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { mocks, testDatabase } = require('./support.cjs');
const { eq } = require('drizzle-orm');
let db, pg, schema, processor, credits, sequence = 0;
const START = new Date(Date.now() - 2 * 86400000).toISOString();
const END = new Date(Date.now() + 28 * 86400000).toISOString();
process.env.WAFFO_ENV = 'test';
process.env.WAFFO_STORE_ID = 'STO_test';
process.env.WAFFO_ENABLED = 'true';
process.env.WAFFO_MERCHANT_ID = 'MER_test';
process.env.WAFFO_PRIVATE_KEY = 'not-used-by-database-tests';
process.env.WAFFO_WEBHOOK_PUBLIC_KEY = 'not-used-by-database-tests';
process.env.WAFFO_OPERATIONS_ENABLED = 'true';

before(async () => {
  ({ db, pg, schema } = await testDatabase());
  processor = require('../../packages/server/src/lib/payments/providers/waffo/processor.ts');
  credits = require('../../packages/server/src/lib/credits/service.ts').CreditService;
});
after(async () => { await pg?.close(); });
beforeEach(async () => {
  await pg.exec('TRUNCATE users CASCADE; TRUNCATE waffo_events;');
  await db.insert(schema.users).values({ id: 'user', email: 'buyer@example.com' });
});

async function order(type = 'one_time', extra = {}) {
  const id = `order-${++sequence}`;
  await db.insert(schema.orders).values({ id, orderNumber: id, userId: 'user', customerEmail: 'buyer@example.com',
    productId: type === 'one_time' ? 'credit_pack_800' : 'tier1:monthly', productName: 'Test product', productType: type,
    amount: '15.00', currency: 'USD', paymentProvider: 'waffo', status: 'pending',
    metadata: type === 'one_time' ? { credits: 800 } : { subscription_interval: 'month', credits_per_period: 800 }, ...extra });
  await db.insert(schema.waffoOrders).values({ orderId: id, mode: 'test', storeId: 'STO_test' });
  return id;
}
function event(orderId, eventType = 'order.completed', data = {}, eventId) {
  return { eventType, eventId: eventId || `${eventType}-${++sequence}`, mode: 'test', storeId: 'STO_test', timestamp: new Date().toISOString(),
    data: { orderId: `ORD_${orderId}`, orderMerchantExternalId: orderId, currency: 'USD', orderStatus: 'completed', paymentStatus: 'succeeded',
      paymentId: `PAY_${orderId}`, chargedAmount: '15.00', listPrice: { subtotal: '15.00', taxAmount: '0.00', total: '15.00' }, ...data } };
}
async function send(payload) { await processor.receiveWaffoEvent(payload); return processor.processWaffoEvents(30); }
async function balance() { const [row] = await db.select().from(schema.userCredits); return row?.totalBalance || 0; }
async function localOrder(id) { return (await db.select().from(schema.orders).where(eq(schema.orders.id, id)))[0]; }

test('durable receipt, duplicate event and duplicate payment grant once', async () => {
  const id = await order(); const payload = event(id);
  await processor.receiveWaffoEvent(payload);
  assert.equal(await balance(), 0);
  await processor.processWaffoEvents();
  await send(payload); await send(event(id));
  assert.equal(await balance(), 800);
  assert.equal((await localOrder(id)).status, 'paid');
  assert.equal((await db.select().from(schema.waffoPayments)).length, 1);
});

test('fulfillment failure rolls back payment and order, then replay recovers once', async () => {
  const id = await order(); const original = credits.grantCredits;
  credits.grantCredits = async () => { throw new Error('Injected credit write failure'); };
  try { assert.equal((await send(event(id))).failed, 1); } finally { credits.grantCredits = original; }
  assert.equal((await localOrder(id)).status, 'pending');
  assert.equal((await db.select().from(schema.waffoPayments)).length, 0);
  await db.update(schema.waffoEvents).set({ nextAttemptAt: new Date(0) });
  await processor.processWaffoEvents();
  assert.equal(await balance(), 800);
});

test('mismatched amount, currency and remote identity never grant', async () => {
  const id = await order();
  await send(event(id, 'order.completed', { listPrice: { subtotal: '15.001' } }));
  await send(event(id, 'order.completed', { currency: 'EUR' }));
  await db.update(schema.waffoOrders).set({ remoteOrderId: 'ORD_other' }).where(eq(schema.waffoOrders.orderId, id));
  await send(event(id));
  assert.equal(await balance(), 0);
  assert.equal((await localOrder(id)).status, 'pending');
});

test('partial refund preserves paid status and unrelated credits for manual review', async () => {
  const id = await order(); await send(event(id));
  await send(event(id, 'refund.succeeded', { refundedAmount: '1.00', refundStatus: 'succeeded' }));
  assert.equal((await localOrder(id)).status, 'paid');
  assert.equal(await balance(), 800);
  assert.equal((await db.select().from(schema.waffoRefunds))[0].creditStatus, 'review');
});

test('full refund of an isolated unspent purchase revokes once', async () => {
  const id = await order(); await send(event(id));
  const refund = event(id, 'refund.succeeded', { refundedAmount: '15.00', refundStatus: 'succeeded' });
  await send(refund); await send(refund);
  assert.equal((await localOrder(id)).status, 'refunded'); assert.equal(await balance(), 0);
  assert.equal((await db.select().from(schema.waffoRefunds))[0].creditStatus, 'resolved');
});

test('refund before payment cannot silently grant refunded credits', async () => {
  const id = await order();
  await send(event(id, 'refund.succeeded', { refundedAmount: '1.00', refundStatus: 'succeeded' }));
  await send(event(id));
  assert.equal(await balance(), 0);
  assert.equal((await db.select().from(schema.waffoOrders))[0].reviewReason, 'refund_before_fulfillment');
});

test('subscription activation and payment in either order grant one period only', async () => {
  for (const reverse of [false, true]) {
    if (reverse) { await pg.exec('TRUNCATE users CASCADE; TRUNCATE waffo_events;'); await db.insert(schema.users).values({ id: 'user', email: 'buyer@example.com' }); }
    const id = await order('subscription');
    const activation = event(id, 'subscription.activated', { orderStatus: 'active', paymentId: undefined, periodNumber: 1,
      billingPeriod: 'monthly', currentPeriodStart: START, currentPeriodEnd: END });
    const payment = event(id, 'subscription.payment_succeeded', { periodNumber: 1 });
    await send(reverse ? payment : activation); assert.equal(await balance(), 0);
    await send(reverse ? activation : payment); await send(activation); await send(payment);
    assert.equal(await balance(), 800); assert.equal((await db.select().from(schema.userSubscriptions)).length, 1);
  }
});

test('cancellation preserves paid period; terminal event cannot be revived by stale event', async () => {
  const id = await order('subscription');
  const period = { periodNumber: 1, billingPeriod: 'monthly', currentPeriodStart: START, currentPeriodEnd: END };
  await send(event(id, 'subscription.payment_succeeded', { periodNumber: 1 }));
  await send(event(id, 'subscription.activated', { ...period, orderStatus: 'active' }));
  await send(event(id, 'subscription.canceling', { ...period, orderStatus: 'canceling' }));
  assert.equal(await balance(), 800); assert.equal((await db.select().from(schema.userSubscriptions))[0].cancelAtPeriodEnd, 1);
  await send(event(id, 'subscription.canceled', { ...period, orderStatus: 'canceled' }));
  await send(event(id, 'subscription.renewed', { ...period, orderStatus: 'active' }));
  assert.equal(await balance(), 0); assert.equal((await db.select().from(schema.userSubscriptions))[0].status, 'expired');
});

test('Waffo cannot mutate a Creem order or provision alongside a Creem subscription', async () => {
  const id = await order('one_time', { paymentProvider: 'creem' }); await send(event(id));
  assert.equal(await balance(), 0); assert.equal((await localOrder(id)).status, 'pending');
  await db.insert(schema.userSubscriptions).values({ id: 'creem', userId: 'user', provider: 'creem', providerSubscriptionId: 'sub_creem',
    planId: 'tier1:monthly', planName: 'Basic', interval: 'month', creditsPerPeriod: 800, currentPeriodStart: new Date(START), currentPeriodEnd: new Date(END) });
  const sub = await order('subscription'); await send(event(sub, 'subscription.payment_succeeded', { periodNumber: 1 }));
  await send(event(sub, 'subscription.activated', { orderStatus: 'active', billingPeriod: 'monthly', periodNumber: 1, currentPeriodStart: START, currentPeriodEnd: END }));
  assert.equal((await db.select().from(schema.userSubscriptions)).length, 1); assert.equal(await balance(), 0);
});

test('RSA webhook verification rejects tampering and accepts final retry window', () => {
  const { verifyWaffoSignature } = require('../../packages/server/src/lib/payments/providers/waffo/events.ts');
  const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  const now = Date.now(); const t = String(now - 32 * 60000); const raw = '{"test":true}';
  const signature = crypto.sign('sha256', Buffer.from(`${t}.${raw}`), keys.privateKey).toString('base64');
  assert.equal(verifyWaffoSignature(raw, `t=${t},v1=${signature}`, keys.publicKey, now), true);
  assert.equal(verifyWaffoSignature(raw + ' ', `t=${t},v1=${signature}`, keys.publicKey, now), false);
  assert.equal(verifyWaffoSignature(raw, `t=${t},v1=${signature}`, keys.publicKey, now + 46 * 60000), false);
});

test('Creem routing survives disabled and malformed Waffo settings', () => {
  process.env.PAYMENT_PROVIDER = 'creem'; delete process.env.PAYMENT_ONE_TIME_PROVIDER; delete process.env.PAYMENT_SUBSCRIPTION_PROVIDER;
  process.env.WAFFO_PACKS = 'broken-json'; process.env.WAFFO_ENV = 'invalid';
  const { getPaymentConfig } = require('../../packages/server/src/lib/payments/core/payment-config.ts');
  const { resolveCheckoutProvider } = require('../../packages/server/src/lib/payments/routing.ts');
  assert.equal(getPaymentConfig().activeProvider, 'creem');
  assert.equal(resolveCheckoutProvider('subscription'), 'creem');
  process.env.PAYMENT_ONE_TIME_PROVIDER = 'waffo'; assert.equal(resolveCheckoutProvider('one_time'), 'waffo');
  assert.equal(resolveCheckoutProvider('subscription'), 'creem');
  delete process.env.PAYMENT_ONE_TIME_PROVIDER; process.env.WAFFO_ENV = 'test'; process.env.WAFFO_PACKS = '{}';
});

test('existing Creem checkout preserves product mapping, metadata and return URLs', async () => {
  const payloads = [];
  mocks.set('@markless/server/src/lib/payments/creem', { newCreemClient: () => ({ createCheckout: async payload => {
    payloads.push(payload); return { id: 'ch_creem', checkout_url: 'https://creem.io/checkout/test' };
  } }) });
  process.env.CREEM_PACKS = JSON.stringify({ credit_pack_800: 'prod_creem_pack' });
  process.env.CREEM_SUBSCRIPTIONS = JSON.stringify({ 'tier1:monthly': 'prod_creem_sub' });
  process.env.PAYMENT_SUCCESS_BASE_URL = 'https://example.com';
  const { CreemProvider } = require('../../packages/server/src/lib/payments/providers/creem/creem-provider.ts');
  const provider = new CreemProvider({ enabled: true, apiKey: 'test' });
  const input = { productId: 'credit_pack_800', productType: 'one_time', amount: '15', currency: 'USD', userId: 'user',
    customerEmail: 'buyer@example.com', orderId: 'local', orderNumber: 'local', requestId: 'request', credits: 800, locale: 'en' };
  const result = await provider.createCheckout({ ...input, returnTo: '/tools/test' });
  assert.equal(result.provider, 'creem'); assert.equal(payloads[0].productId, 'prod_creem_pack');
  assert.equal(new URL(payloads[0].successUrl).pathname, '/tools/test');
  assert.equal(payloads[0].metadata.credits, 800); assert.equal(payloads[0].metadata.order_id, 'local');
  await provider.createCheckout({ ...input, productType: 'subscription', productId: 'tier1:monthly', interval: 'month', creditsPerPeriod: 800 });
  assert.equal(payloads[1].productId, 'prod_creem_sub'); assert.equal(payloads[1].metadata.credits_per_period, 800);
  assert.equal(new URL(payloads[1].successUrl).pathname, '/dashboard');
});

test('Creem creation, renewal, cancellation and resume retain existing credit behavior', async () => {
  const calls = [];
  mocks.set('@markless/server/src/lib/payments/creem', { newCreemClient: () => ({
    cancelSubscription: async args => calls.push(['cancel', args]), resumeSubscription: async args => calls.push(['resume', args]),
  }) });
  const { SubscriptionService } = require('../../packages/server/src/lib/subscriptions/service.ts');
  const subscription = await SubscriptionService.createSubscription({ userId: 'user', planId: 'tier1:monthly', planName: 'Basic',
    provider: 'creem', providerSubscriptionId: 'sub_creem', interval: 'month', creditsPerPeriod: 800,
    currentPeriodStart: new Date('2026-01-01'), currentPeriodEnd: new Date('2026-02-01') });
  assert.equal(await balance(), 800);
  await SubscriptionService.renewSubscription({ providerSubscriptionId: 'sub_creem', currentPeriodStart: new Date(START), currentPeriodEnd: new Date(END) });
  assert.equal(await balance(), 800);
  await SubscriptionService.cancelSubscription('sub_creem', true);
  assert.equal(await balance(), 800); assert.equal(calls[0][1].immediate, false);
  await SubscriptionService.resumeSubscription('sub_creem'); assert.equal(calls[1][0], 'resume');
  assert.equal((await db.select().from(schema.userSubscriptions).where(eq(schema.userSubscriptions.id, subscription.id)))[0].cancelAtPeriodEnd, 0);
});

test('payment result requires authentication and ownership, and pending is never settled', async () => {
  let userId = null;
  mocks.set('@markless/server/src/lib/auth/server', { auth: { api: { getSession: async () => userId ? { user: { id: userId } } : null } } });
  const route = require('../../apps/api/src/app/api/payment/success/route.ts');
  const id = await order();
  const request = () => new Request('https://example.com/api/payment/success', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: id }) });
  assert.equal((await route.POST(request())).status, 401);
  userId = 'other'; assert.equal((await route.POST(request())).status, 403);
  userId = 'user'; const pending = await (await route.POST(request())).json(); assert.equal(pending.settled, false);
  await send(event(id)); const paid = await (await route.POST(request())).json(); assert.equal(paid.settled, true);
});

test('Waffo checkout signs exact body and honors tool return path', async () => {
  const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  process.env.WAFFO_PRIVATE_KEY = keys.privateKey; process.env.WAFFO_PACKS = JSON.stringify({ credit_pack_800: 'PROD_test' });
  const previousFetch = global.fetch; let captured;
  global.fetch = async (url, init) => { captured = { url, ...init }; return new Response(JSON.stringify({ data: { sessionId: 'cs_test', checkoutUrl: 'https://checkout.waffo.ai/test', expiresAt: END } }), { status: 200 }); };
  try {
    const { WaffoProvider } = require('../../packages/server/src/lib/payments/providers/waffo/waffo-provider.ts');
    await new WaffoProvider({ enabled: true }).createCheckout({ productType: 'one_time', productId: 'credit_pack_800', amount: '15', currency: 'USD',
      orderId: 'local', requestId: 'request', userId: 'user', customerEmail: 'buyer@example.com', returnTo: '/tools/test' });
    const canonical = `POST\n/v1/actions/checkout/create-session\n${captured.headers['X-Timestamp']}\n${crypto.createHash('sha256').update(captured.body).digest('base64')}`;
    assert.equal(crypto.verify('sha256', Buffer.from(canonical), keys.publicKey, Buffer.from(captured.headers['X-Signature'], 'base64')), true);
    assert.equal(new URL(JSON.parse(captured.body).successUrl).pathname, '/tools/test');
  } finally { global.fetch = previousFetch; process.env.WAFFO_PRIVATE_KEY = 'not-used'; }
});

test('renewal and late old receipts cannot revert a paid subscription period', async () => {
  const id = await order('subscription');
  const first = { periodNumber: 1, billingPeriod: 'monthly', currentPeriodStart: new Date(Date.now() - 40 * 86400000).toISOString(), currentPeriodEnd: new Date(Date.now() - 10 * 86400000).toISOString() };
  await send(event(id, 'subscription.payment_succeeded', { periodNumber: 2, paymentId: 'PAY_renewal' }));
  const renewal = event(id, 'subscription.renewed', { periodNumber: 2, billingPeriod: 'monthly', orderStatus: 'active', currentPeriodStart: START, currentPeriodEnd: END });
  await send(renewal); assert.equal(await balance(), 800);
  const stale = event(id, 'subscription.activated', { ...first, orderStatus: 'active' }); stale.timestamp = new Date(Date.now() - 60000).toISOString();
  await send(stale); await send(event(id, 'subscription.payment_succeeded', { periodNumber: 1 })); await send(renewal);
  assert.equal(await balance(), 800);
  assert.equal((await db.select().from(schema.userSubscriptions))[0].currentPeriodStart.toISOString(), START);
});

test('annual drip clamps month end, skips missed months and never grants expired access', async () => {
  const id = await order('subscription', { metadata: { subscription_interval: 'year', credits_per_period: 9600 } });
  const start = new Date(); start.setUTCMonth(0, 31); start.setUTCHours(0, 0, 0, 0);
  if (start > new Date()) start.setUTCFullYear(start.getUTCFullYear() - 1);
  const end = new Date(start); end.setUTCFullYear(end.getUTCFullYear() + 1);
  await send(event(id, 'subscription.payment_succeeded', { periodNumber: 1 }));
  await send(event(id, 'subscription.activated', { periodNumber: 1, billingPeriod: 'yearly', orderStatus: 'active', currentPeriodStart: start.toISOString(), currentPeriodEnd: end.toISOString() }));
  const { grantWaffoYearlyCredits } = require('../../packages/server/src/lib/payments/providers/waffo/operations.ts');
  const feb = new Date(start); feb.setUTCMonth(2, 0);
  assert.equal((await grantWaffoYearlyCredits(feb)).granted, 1);
  assert.equal((await grantWaffoYearlyCredits(feb)).granted, 0);
  const may = new Date(start); may.setUTCMonth(4, 31);
  assert.equal((await grantWaffoYearlyCredits(may)).granted, 1);
  assert.equal((await grantWaffoYearlyCredits(end)).granted, 0);
  assert.equal(await balance(), 800);
  const grants = (await db.select().from(schema.creditTransactions)).filter(t => t.type === 'subscription_grant');
  assert.equal(grants.length, 3);
});

test('missing terminal callbacks expire only scoped Waffo subscriptions and credits', async () => {
  const id = await order('subscription');
  await send(event(id, 'subscription.payment_succeeded', { periodNumber: 1 }));
  await send(event(id, 'subscription.activated', { periodNumber: 1, billingPeriod: 'monthly', orderStatus: 'active', currentPeriodStart: START, currentPeriodEnd: END }));
  const { expireWaffoSubscriptions } = require('../../packages/server/src/lib/payments/providers/waffo/operations.ts');
  assert.equal((await expireWaffoSubscriptions(new Date(Date.parse(END) + 1))).expired, 1);
  assert.equal(await balance(), 0);
  assert.equal((await db.select().from(schema.userSubscriptions))[0].status, 'past_due');
  assert.equal((await expireWaffoSubscriptions(new Date(Date.parse(END) + 1))).expired, 0);
});

test('confirmed plan replacement keeps new credits when original cancellation arrives', async () => {
  const origin = await order('subscription');
  const period = { periodNumber: 1, billingPeriod: 'monthly', currentPeriodStart: START, currentPeriodEnd: END };
  await send(event(origin, 'subscription.payment_succeeded', { periodNumber: 1 }));
  await send(event(origin, 'subscription.activated', { ...period, orderStatus: 'active' }));
  const old = (await db.select().from(schema.userSubscriptions))[0];
  const next = await order('subscription', { metadata: { subscription_interval: 'month', credits_per_period: 1600, waffo_origin_subscription_id: old.id } });
  await send(event(next, 'subscription.payment_succeeded', { periodNumber: 1 }));
  await send(event(next, 'subscription.plan_changed', { ...period, orderStatus: 'active' }));
  assert.equal(await balance(), 1600);
  await send(event(origin, 'subscription.canceled', { ...period, orderStatus: 'canceled' }));
  assert.equal(await balance(), 1600);
  assert.equal((await db.select().from(schema.userSubscriptions)).filter(s => s.status === 'active').length, 1);
});

test('failed scheduled plan clears pending fields without replacing current entitlement', async () => {
  const origin = await order('subscription');
  await send(event(origin, 'subscription.payment_succeeded', { periodNumber: 1 }));
  await send(event(origin, 'subscription.activated', { periodNumber: 1, billingPeriod: 'monthly', orderStatus: 'active', currentPeriodStart: START, currentPeriodEnd: END }));
  const old = (await db.select().from(schema.userSubscriptions))[0];
  const next = await order('subscription', { productId: 'tier2:monthly', metadata: { subscription_interval: 'month', credits_per_period: 1600, waffo_origin_subscription_id: old.id } });
  await send(event(next, 'subscription.plan_change_scheduled', { orderStatus: 'pending', planChange: { effectiveDate: END } }));
  assert.equal((await db.select().from(schema.userSubscriptions))[0].scheduledPlanId, 'tier2:monthly');
  await send(event(next, 'subscription.plan_change_failed', { orderStatus: 'canceled' }));
  assert.equal((await db.select().from(schema.userSubscriptions))[0].scheduledPlanId, null);
  assert.equal((await localOrder(next)).status, 'failed'); assert.equal(await balance(), 800);
});

test('refund replay after revocation does not reopen a credit review', async () => {
  const id = await order(); await send(event(id));
  await send(event(id, 'refund.succeeded', { refundedAmount: '15.00', refundStatus: 'succeeded' }, 'REF_replay'));
  await send(event(id));
  assert.equal(await balance(), 0);
  assert.equal((await db.select().from(schema.waffoOrders))[0].reviewReason, null);
  assert.equal((await db.select().from(schema.waffoRefunds))[0].creditStatus, 'resolved');
});

test('reconciliation recovers missing payment and refund callbacks without granting refunded goods', async () => {
  const id = await order();
  const originalFetch = global.fetch; const originalKey = process.env.WAFFO_PRIVATE_KEY;
  process.env.WAFFO_PRIVATE_KEY = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }).privateKey;
  global.fetch = async (_url, init) => {
    const { query } = JSON.parse(init.body);
    const data = query.includes('onetimeOrders') ? { onetimeOrders: [{ id: `ORD_${id}`, status: 'completed', updatedAt: new Date().toISOString() }] }
      : query.includes('refunds(') ? { refunds: [{ id: 'REF_remote', paymentId: `PAY_${id}`, status: 'succeeded', createdAt: new Date().toISOString(), pspAmountDetails: { amount: '15.00', currency: 'USD' } }] }
      : { payments: [{ id: `PAY_${id}`, orderId: `ORD_${id}`, status: 'succeeded', createdAt: new Date().toISOString(), amount: { display: '15.00', currency: 'USD' }, snapshotAmountDetails: { subtotal: '15.00', total: '15.00', taxAmount: '0.00', currency: 'USD' } }] };
    return new Response(JSON.stringify({ data }), { status: 200 });
  };
  try {
    const { reconcileWaffoOrders } = require('../../packages/server/src/lib/payments/providers/waffo/operations.ts');
    assert.equal((await reconcileWaffoOrders()).reconciled, 1);
    await processor.processWaffoEvents();
    assert.equal(await balance(), 0); assert.equal((await localOrder(id)).status, 'refunded');
    assert.equal((await db.select().from(schema.waffoPayments)).length, 1);
  } finally { global.fetch = originalFetch; process.env.WAFFO_PRIVATE_KEY = originalKey; }
});

test('Waffo admin rejects unauthenticated and malformed refund operations', async () => {
  let authenticated = false;
  mocks.set('@markless/server/src/lib/admin/require-admin-session', { requireAdminSession: async () => authenticated ? { user: { id: 'admin' } } : null });
  const route = require('../../apps/api/src/app/api/admin/payments/waffo/route.ts');
  const request = body => new Request('https://example.com/api/admin/payments/waffo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  assert.equal((await route.POST(request('{}'))).status, 401);
  authenticated = true;
  assert.equal((await route.POST(request('invalid'))).status, 400);
  assert.equal((await route.POST(request(JSON.stringify({ action: 'request-refund', paymentId: 'PAY_test', amount: 'NaN', reason: 'test' })))).status, 400);
});

test('subscription reservations reject duplicate pending checkouts even after an ambiguous timeout', async () => {
  const { createWaffoOrder } = require('../../packages/server/src/lib/payments/providers/waffo/checkout.ts');
  const input = { id: 'reserved', orderNumber: 'reserved', userId: 'user', customerEmail: 'buyer@example.com', productId: 'tier1:monthly',
    productName: 'Basic', productType: 'subscription', amount: '15', currency: 'USD', paymentProvider: 'waffo', status: 'pending' };
  await createWaffoOrder(input);
  await db.update(schema.orders).set({ createdAt: new Date(Date.now() - 86400000) }).where(eq(schema.orders.id, 'reserved'));
  await assert.rejects(createWaffoOrder({ ...input, id: 'duplicate', orderNumber: 'duplicate' }), /existingSubscription/);
  assert.equal((await db.select().from(schema.orders)).length, 1);
});

test('cancel and resume snapshots survive late duplicate payment receipts', async () => {
  const id = await order('subscription');
  await send(event(id, 'subscription.payment_succeeded', { periodNumber: 1 }));
  await send(event(id, 'subscription.activated', { periodNumber: 1, billingPeriod: 'monthly', orderStatus: 'active', currentPeriodStart: START, currentPeriodEnd: END }));
  const originalFetch = global.fetch; const originalKey = process.env.WAFFO_PRIVATE_KEY;
  process.env.WAFFO_PRIVATE_KEY = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }).privateKey;
  global.fetch = async url => new Response(JSON.stringify({ data: String(url).includes('issue-session-token') ? { token: 'customer-secret' } : { status: String(url).includes('reactivate') ? 'active' : 'canceling' } }), { status: 200 });
  try {
    const { cancelWaffoSubscription, resumeWaffoSubscription } = require('../../packages/server/src/lib/payments/providers/waffo/subscriptions.ts');
    let subscription = (await db.select().from(schema.userSubscriptions))[0];
    subscription = await cancelWaffoSubscription(subscription);
    await send(event(id, 'subscription.payment_succeeded', { periodNumber: 1 }));
    assert.equal((await db.select().from(schema.userSubscriptions))[0].cancelAtPeriodEnd, 1);
    await resumeWaffoSubscription(subscription);
    await send(event(id, 'subscription.payment_succeeded', { periodNumber: 1 }));
    assert.equal((await db.select().from(schema.userSubscriptions))[0].cancelAtPeriodEnd, 0);
    assert.equal(await balance(), 800);
  } finally { global.fetch = originalFetch; process.env.WAFFO_PRIVATE_KEY = originalKey; }
});

test('refund callbacks preceding API responses stay completed and allow only the remaining refundable amount', async () => {
  const id = await order(); await send(event(id));
  const originalFetch = global.fetch; const originalKey = process.env.WAFFO_PRIVATE_KEY;
  process.env.WAFFO_PRIVATE_KEY = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }).privateKey;
  let count = 0;
  global.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    await send(event(id, 'refund.succeeded', { refundStatus: 'succeeded', refundedAmount: body.requestedAmount.amount,
      refundTicketMerchantExternalId: body.refundTicketMerchantExternalId }, `REF_admin_${++count}`));
    return new Response(JSON.stringify({ data: { ticket: { id: `ticket_${count}`, status: 'processing' } } }), { status: 200 });
  };
  try {
    const { POST } = require('../../apps/api/src/app/api/admin/payments/waffo/route.ts');
    const request = amount => new Request('https://example.com/api/admin/payments/waffo', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'request-refund', paymentId: `PAY_${id}`, amount, reason: 'Test refund' }) });
    assert.equal((await POST(request('1.00'))).status, 200);
    assert.equal((await db.select().from(schema.waffoRefunds)).find(row => row.refundId.startsWith('request:')).status, 'completed');
    assert.equal((await POST(request('15.00'))).status, 409);
    assert.equal((await POST(request('14.00'))).status, 200);
    assert.equal(await balance(), 0); assert.equal((await localOrder(id)).status, 'refunded');
  } finally { global.fetch = originalFetch; process.env.WAFFO_PRIVATE_KEY = originalKey; }
});
