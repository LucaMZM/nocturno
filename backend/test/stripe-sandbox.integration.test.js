import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { env } from '../src/config/env.js';
import { getPool, closePool } from '../src/config/db.js';
import { cartService } from '../src/services/cart.service.js';
import { checkoutService } from '../src/services/checkout.service.js';
import { paymentService } from '../src/services/payment.service.js';
import { stripeApiService } from '../src/services/stripe-api.service.js';
import { orderRepository } from '../src/repositories/order.repository.js';

// Real PostgreSQL transactions and real services. ONLY the external Stripe boundary
// is mocked; these tests are not proof of a real Stripe Sandbox purchase.
test('checkout retries, expiry races and out-of-order full refunds retain stock and QR integrity',
  { skip: !env.DATABASE_URL }, async t => {
    const pool = getPool(), ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    const [user, venue, event, type] = ids;
    const original = { ...stripeApiService }, config = [env.STRIPE_SECRET_KEY, env.STRIPE_PUBLISHABLE_KEY, env.STRIPE_WEBHOOK_SECRET];
    const intents = new Map(); let creates = 0;
    const intentFor = order => ({ id: 'pi_mock_' + order.id.replaceAll('-', ''), status: 'requires_payment_method',
      amount: order.totalCents, amount_received: 0, currency: 'eur', livemode: false,
      metadata: { order_id: order.id }, client_secret: 'mock-client-secret-not-a-credential' });
    async function newCheckout() {
      await cartService.clear(user);
      await cartService.addItem(user, { ticketTypeId: type, quantity: 2 });
      return checkoutService.startCheckout(user, randomUUID());
    }
    async function stock() { return (await pool.query('SELECT sold,reserved FROM ticket_types WHERE id=$1', [type])).rows[0]; }
    async function expire(orderId) { await pool.query("UPDATE orders SET expires_at=NOW()-interval '1 second' WHERE id=$1", [orderId]); }
    try {
      [env.STRIPE_SECRET_KEY, env.STRIPE_PUBLISHABLE_KEY, env.STRIPE_WEBHOOK_SECRET] =
        ['sk_test_sandbox_fixture', 'pk_test_sandbox_fixture', 'whsec_sandbox_fixture'];
      await pool.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Sandbox fixture')", [user, user + '@example.test']);
      await pool.query("INSERT INTO venues(id,name,slug,type,province,municipality,address) VALUES($1,'Sandbox venue',$2,'CLUB','Valencia','Valencia','Fixture')", [venue, 'sandbox-' + venue]);
      await pool.query("INSERT INTO events(id,venue_id,title,slug,event_type,starts_at,ends_at,status) VALUES($1,$2,'Sandbox event',$3,'CLUB',NOW()+interval '2 days',NOW()+interval '3 days','PUBLISHED')", [event, venue, 'sandbox-' + event]);
      await pool.query("INSERT INTO ticket_types(id,event_id,name,price,quantity,max_per_user) VALUES($1,$2,'General',14,100,100)", [type, event]);
      stripeApiService.createPaymentIntent = async order => { creates++; await new Promise(resolve => setTimeout(resolve, 10));
        const intent = intentFor(order); intents.set(intent.id, intent); return intent; };
      stripeApiService.retrievePaymentIntent = async id => ({ ...intents.get(id) });
      stripeApiService.cancelPaymentIntent = async id => { const intent = intents.get(id); intent.status = 'canceled'; return { ...intent }; };
      let first;
      await t.test('concurrent double submit reserves once, creates once and returns the same intent', async () => {
        await pool.query('UPDATE ticket_types SET quantity=2 WHERE id=$1',[type]);
        await cartService.addItem(user, { ticketTypeId: type, quantity: 2 });
        const key = randomUUID();
        const [a, b] = await Promise.all([checkoutService.startCheckout(user, key), checkoutService.startCheckout(user, key)]);
        first = a;
        assert.equal(a.order.id, b.order.id); assert.equal(creates, 1);
        assert.equal(a.order.totalCents, 2800); assert.equal(a.clientSecret, b.clientSecret);
        assert.deepEqual(await stock(), { sold: 0, reserved: 2 });
        assert.equal((await cartService.getCart(user)).items[0].purchasable,false);
        assert.equal((await checkoutService.startCheckout(user,key)).order.id,a.order.id,'Own last units can resume their reservation');
        await pool.query('UPDATE ticket_types SET quantity=100 WHERE id=$1',[type]);
      });
      await t.test('decline then success, duplicate success and late failure never duplicate units', async () => {
        const intent = intents.get(first.order.providerPaymentId);
        await paymentService.failPaymentIntent(intent);
        intent.status = 'succeeded'; intent.amount_received = 2800;
        await assert.rejects(() => paymentService.confirmPaymentIntent({ ...intent, currency: 'usd' }), { code: 'PAYMENT_AMOUNT_MISMATCH' });
        await assert.rejects(() => paymentService.confirmPaymentIntent({ ...intent, metadata: { order_id: randomUUID() } }), { code: 'PAYMENT_AMOUNT_MISMATCH' });
        await Promise.all([paymentService.confirmPaymentIntent(intent), paymentService.confirmPaymentIntent(intent)]);
        await paymentService.failPaymentIntent(intent);
        const order = await orderRepository.getOrder(first.order.id, user);
        assert.equal(order.status, 'PAID'); assert.equal(order.paymentStatus, 'PAID');
        assert.equal(order.tickets.length, 2); assert.equal(new Set(order.tickets.map(row => row.code)).size, 2);
        assert.deepEqual(await stock(), { sold: 2, reserved: 0 });
      });
      await t.test('admin full refund waits for webhook confirmation, repeated requests are harmless', async () => {
        let requests = 0;
        stripeApiService.createRefund = async id => { requests++; return { id: 're_mock_full', payment_intent: id, amount: 2800, currency: 'eur', status: 'succeeded' }; };
        assert.equal((await paymentService.requestFullRefund(first.order.paymentId)).status, 'PENDING');
        await paymentService.requestFullRefund(first.order.paymentId); assert.equal(requests, 1);
        assert.equal((await orderRepository.getOrder(first.order.id, user)).status, 'PAID');
        const charge = { payment_intent: first.order.providerPaymentId, amount: 2800, amount_refunded: 2800, currency: 'eur' };
        await assert.rejects(() => paymentService.refundCharge({ ...charge, currency: 'usd' }), { code: 'REFUND_AMOUNT_MISMATCH' });
        await paymentService.refundCharge(charge); await paymentService.refundCharge(charge);
        const order = await orderRepository.getOrder(first.order.id, user);
        assert.equal(order.status, 'REFUNDED'); assert.ok(order.tickets.every(row => row.status === 'REFUNDED'));
        assert.deepEqual(await stock(), { sold: 0, reserved: 0 });
      });
      await t.test('refund arriving before succeeded fulfills and invalidates atomically; late success stays refunded', async () => {
        const { order } = await newCheckout(), intent = intents.get(order.providerPaymentId);
        await paymentService.refundCharge({ payment_intent: intent.id, amount: 2800, amount_refunded: 2800, currency: 'eur' });
        await paymentService.confirmPaymentIntent({ ...intent, status: 'succeeded', amount_received: 2800 });
        const result = await orderRepository.getOrder(order.id, user);
        assert.equal(result.status, 'REFUNDED'); assert.equal(result.tickets.length, 2);
        assert.ok(result.tickets.every(row => row.status === 'REFUNDED'));
        assert.deepEqual(await stock(), { sold: 0, reserved: 0 });
      });
      await t.test('expiry reconciles a succeeded intent when its webhook is delayed', async () => {
        const { order } = await newCheckout(), intent = intents.get(order.providerPaymentId);
        intent.status = 'succeeded'; intent.amount_received = 2800;
        await expire(order.id); await checkoutService.expireStaleOrders();
        assert.equal((await orderRepository.getOrder(order.id, user)).status, 'PAID');
        assert.deepEqual(await stock(), { sold: 2, reserved: 0 });
      });
      await t.test('processing or uncertain cancellation retains stock; confirmed cancellation releases only once', async () => {
        const { order } = await newCheckout(), intent = intents.get(order.providerPaymentId);
        await expire(order.id); intent.status = 'processing';
        stripeApiService.cancelPaymentIntent = async () => { throw new Error('Uncertain provider state'); };
        await checkoutService.expireStaleOrders();
        assert.equal((await orderRepository.getOrder(order.id, user)).status, 'AWAITING_PAYMENT');
        assert.deepEqual(await stock(), { sold: 2, reserved: 2 });
        intent.status = 'canceled'; await checkoutService.expireStaleOrders(); await checkoutService.expireStaleOrders();
        assert.equal((await orderRepository.getOrder(order.id, user)).status, 'EXPIRED');
        assert.deepEqual(await stock(), { sold: 2, reserved: 0 });
      });
      await t.test('success racing cancellation is reconciled without releasing its reservation', async () => {
        const { order } = await newCheckout(), intent = intents.get(order.providerPaymentId);
        await expire(order.id);
        stripeApiService.cancelPaymentIntent = async () => { intent.status = 'succeeded'; intent.amount_received = 2800; throw new Error('Already succeeded'); };
        await checkoutService.expireStaleOrders();
        assert.equal((await orderRepository.getOrder(order.id, user)).status, 'PAID');
        assert.deepEqual(await stock(), { sold: 4, reserved: 0 });
      });
      await t.test('mismatched provider amount cannot attach a PaymentIntent or expose its client secret', async () => {
        stripeApiService.createPaymentIntent = async order => ({ ...intentFor(order), amount: 1 });
        await cartService.addItem(user, { ticketTypeId: type, quantity: 2 });
        await assert.rejects(() => checkoutService.startCheckout(user, randomUUID()), { code: 'INVALID_PAYMENT_PROVIDER_RESPONSE' });
        const invalid = (await pool.query("SELECT p.provider_payment_id FROM payments p JOIN orders o ON o.id=p.order_id WHERE o.user_id=$1 AND o.status='AWAITING_PAYMENT'", [user])).rows;
        assert.ok(invalid.every(row => row.provider_payment_id === null));
      });
    } finally {
      Object.assign(stripeApiService, original);
      [env.STRIPE_SECRET_KEY, env.STRIPE_PUBLISHABLE_KEY, env.STRIPE_WEBHOOK_SECRET] = config;
      await pool.query('DELETE FROM tickets WHERE user_id=$1', [user]);
      await pool.query('DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE user_id=$1)', [user]);
      await pool.query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id=$1)', [user]);
      await pool.query('DELETE FROM orders WHERE user_id=$1', [user]);
      await pool.query('DELETE FROM users WHERE id=$1', [user]);
      await pool.query('DELETE FROM events WHERE id=$1', [event]);
      await pool.query('DELETE FROM venues WHERE id=$1', [venue]);
      await closePool();
    }
  });
