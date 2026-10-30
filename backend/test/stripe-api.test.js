import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { env } from '../src/config/env.js';
import { stripeApiService } from '../src/services/stripe-api.service.js';
import { verifyStripeWebhook } from '../src/services/payment.service.js';

const config = () => ({ STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY: env.STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET });
const fixture = { STRIPE_SECRET_KEY: 'sk_test_unit_fixture', STRIPE_PUBLISHABLE_KEY: 'pk_test_unit_fixture',
  STRIPE_WEBHOOK_SECRET: 'whsec_unit_fixture' };

test('public configuration never exposes a secret accidentally placed in the publishable field', () => {
  const before = config();
  try {
    Object.assign(env, fixture);
    assert.deepEqual(stripeApiService.publicConfiguration(), { enabled: true, testMode: true, publishableKey: fixture.STRIPE_PUBLISHABLE_KEY });
    env.STRIPE_PUBLISHABLE_KEY = fixture.STRIPE_SECRET_KEY;
    assert.deepEqual(stripeApiService.publicConfiguration(), { enabled: false, testMode: false, publishableKey: null });
    env.STRIPE_PUBLISHABLE_KEY = 'pk_live_not_a_credential';
    assert.equal(stripeApiService.publicConfiguration().enabled, false);
    assert.equal(stripeApiService.publicConfiguration().publishableKey, null);
    env.STRIPE_SECRET_KEY = 'sk_live_not_a_credential';
    assert.throws(() => stripeApiService.requireConfiguration(), { code: 'STRIPE_TEST_KEY_REQUIRED' });
  } finally { Object.assign(env, before); }
});

test('Stripe adapter pins API, uses server cents, dynamic methods, bounded requests and stable idempotency', async () => {
  const before = config(), originalFetch = globalThis.fetch, calls = [];
  Object.assign(env, fixture);
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ id: 'fixture' }) }; };
  try {
    const order = { id: 'order-fixture', totalCents: 2800, currency: 'EUR' };
    await stripeApiService.createPaymentIntent(order);
    await stripeApiService.createPaymentIntent(order);
    const fields = calls[0].options.body;
    assert.equal(fields.get('amount'), '2800');
    assert.equal(fields.get('currency'), 'eur');
    assert.equal(fields.get('metadata[order_id]'), order.id);
    assert.equal(fields.get('automatic_payment_methods[enabled]'), 'true');
    assert.equal(fields.get('automatic_payment_methods[allow_redirects]'), 'never');
    assert.equal(fields.has('payment_method_types[]'), false);
    assert.equal(calls[0].options.headers['stripe-version'], '2026-09-30.endive');
    assert.equal(calls[0].options.headers['idempotency-key'], calls[1].options.headers['idempotency-key']);
    assert.ok(calls[0].options.signal instanceof AbortSignal);
    await stripeApiService.createRefund('pi_fixture', 'payment-fixture');
    await stripeApiService.createRefund('pi_fixture', 'payment-fixture');
    assert.equal(calls[2].options.body.has('amount'), false, 'Only full refunds');
    assert.equal(calls[2].options.headers['idempotency-key'], calls[3].options.headers['idempotency-key']);
  } finally { Object.assign(env, before); globalThis.fetch = originalFetch; }
});

test('provider errors never leak provider bodies or credentials', async () => {
  const before = config(), originalFetch = globalThis.fetch;
  Object.assign(env, fixture);
  try {
    for (const fake of [
      async () => { throw new Error('sensitive provider detail'); },
      async () => ({ ok: false, json: async () => ({ error: { message: 'sensitive provider detail' } }) }),
      async () => ({ ok: true, json: async () => { throw new Error('sensitive provider detail'); } }),
    ]) {
      globalThis.fetch = fake;
      await assert.rejects(() => stripeApiService.retrievePaymentIntent('pi_fixture'), error => {
        assert.equal(error.status, 502);
        assert.ok(!error.message.includes('sensitive'));
        assert.ok(!error.message.includes(fixture.STRIPE_SECRET_KEY));
        return true;
      });
    }
  } finally { Object.assign(env, before); globalThis.fetch = originalFetch; }
});

test('signed raw webhook validates freshness, rotation, envelope and Sandbox mode', () => {
  const secret = fixture.STRIPE_WEBHOOK_SECRET, now = Math.floor(Date.now() / 1000);
  const sign = (body, timestamp = now) => `t=${timestamp},v1=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
  const body = JSON.stringify({ livemode: false, type: 'payment_intent.succeeded', data: { object: { id: 'pi_fixture' } } });
  assert.equal(verifyStripeWebhook(Buffer.from(body), sign(body) + ',v1=' + '0'.repeat(64), secret).type, 'payment_intent.succeeded');
  assert.throws(() => verifyStripeWebhook(Buffer.from(body), sign(body, now - 301), secret), { code: 'INVALID_STRIPE_SIGNATURE' });
  assert.throws(() => verifyStripeWebhook(Buffer.from(body + ' '), sign(body), secret), { code: 'INVALID_STRIPE_SIGNATURE' });
  const live = body.replace('false', 'true');
  assert.throws(() => verifyStripeWebhook(Buffer.from(live), sign(live), secret), { code: 'STRIPE_TEST_EVENT_REQUIRED' });
  for (const malformed of ['{}', 'null', '{', '{"type":"x","data":{}}'])
    assert.throws(() => verifyStripeWebhook(Buffer.from(malformed), sign(malformed), secret), { code: 'INVALID_WEBHOOK_BODY' });
});
