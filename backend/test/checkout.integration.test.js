import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { getPool, closePool } from '../src/config/db.js';
import { checkoutService } from '../src/services/checkout.service.js';
import { ticketService } from '../src/services/ticket.service.js';
import { cartService } from '../src/services/cart.service.js';

test('two concurrent PostgreSQL checkouts cannot oversell; duplicate webhook does not duplicate tickets',
  { skip: !env.DATABASE_URL }, async () => {
    const venueId = randomUUID();
    const eventId = randomUUID();
    const ticketTypeId = randomUUID();
    const users = [randomUUID(), randomUUID()];
    let orderId;
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const stripeConfig = [env.STRIPE_SECRET_KEY, env.STRIPE_PUBLISHABLE_KEY, env.STRIPE_WEBHOOK_SECRET];
    try {
      env.STRIPE_SECRET_KEY = 'sk_test_integration_fixture';
      env.STRIPE_PUBLISHABLE_KEY = 'pk_test_integration_fixture';
      env.STRIPE_WEBHOOK_SECRET = 'whsec_integration_fixture';
      for (const userId of users)
        await getPool().query(
          `INSERT INTO users (id, email, display_name) VALUES ($1, $2, 'Checkout fixture')`,
          [userId, `checkout-${userId}@example.com`]);
      await getPool().query(
        `INSERT INTO venues (id, name, slug, type, province, municipality, address)
         VALUES ($1, 'Fixture', $2, 'CLUB', 'Valencia', 'Valencia', 'Fixture street')`,
        [venueId, `fixture-${venueId}`]);
      await getPool().query(
        `INSERT INTO events (id, venue_id, title, slug, event_type, starts_at, ends_at, status)
         VALUES ($1, $2, 'Stock fixture', $3, 'CLUB', NOW() + INTERVAL '2 days',
                 NOW() + INTERVAL '2 days 6 hours', 'PUBLISHED')`,
        [eventId, venueId, `stock-fixture-${eventId}`]);
      await getPool().query(
        `INSERT INTO ticket_types (id, event_id, name, price, quantity)
         VALUES ($1, $2, 'General', 10.00, 3)`, [ticketTypeId, eventId]);
      for (const userId of users)
        assert.equal((await cartService.addItem(userId, { ticketTypeId, quantity: 2 })).totalCents, 2000);
      const results = await Promise.allSettled(users.map((userId) =>
        checkoutService.createOrderFromCart(userId, randomUUID())));
      assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
      assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
      assert.equal(results.find((result) => result.status === 'rejected').reason.code, 'OUT_OF_STOCK');
      orderId = results.find((result) => result.status === 'fulfilled').value;
      const stock = await getPool().query('SELECT sold, reserved FROM ticket_types WHERE id = $1', [ticketTypeId]);
      assert.deepEqual([stock.rows[0].sold, stock.rows[0].reserved], [0, 2]);
      const paymentIntentId = `pi_fixture_${randomUUID()}`;
      await getPool().query(
        'UPDATE payments SET provider_payment_id = $2 WHERE order_id = $1', [orderId, paymentIntentId]);
      const success = { id: paymentIntentId, amount_received: 2000, currency: 'eur' };
      const raw = JSON.stringify({ type: 'payment_intent.succeeded', data: { object: success } });
      const timestamp = Math.floor(Date.now() / 1000);
      const digest = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET)
        .update(`${timestamp}.${raw}`).digest('hex');
      const webhook = (signature) => fetch(
        `http://127.0.0.1:${server.address().port}/api/stripe/webhook`,
        { method: 'POST', headers: { 'content-type': 'application/json',
          'stripe-signature': signature }, body: raw });
      assert.equal((await webhook(`t=${timestamp},v1=bad`)).status, 400);
      const wrongAmount = JSON.stringify({ type: 'payment_intent.succeeded',
        data: { object: { ...success, amount_received: 1000 } } });
      const wrongDigest = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET)
        .update(`${timestamp}.${wrongAmount}`).digest('hex');
      const rejectedAmount = await fetch(
        `http://127.0.0.1:${server.address().port}/api/stripe/webhook`,
        { method: 'POST', headers: { 'content-type': 'application/json',
          'stripe-signature': `t=${timestamp},v1=${wrongDigest}` }, body: wrongAmount });
      assert.equal(rejectedAmount.status, 409);
      assert.equal((await getPool().query('SELECT count(*) AS total FROM tickets WHERE event_id = $1',
        [eventId])).rows[0].total, '0');
      const sendSigned = async (event) => {
        const body = JSON.stringify(event);
        const signed = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET)
          .update(`${timestamp}.${body}`).digest('hex');
        return fetch(`http://127.0.0.1:${server.address().port}/api/stripe/webhook`, {
          method: 'POST', headers: { 'content-type': 'application/json',
            'stripe-signature': `t=${timestamp},v1=${signed}` }, body,
        });
      };
      const failed = { type: 'payment_intent.payment_failed', data: { object: { id: paymentIntentId } } };
      assert.equal((await sendSigned(failed)).status, 200);
      assert.equal((await sendSigned(failed)).status, 200);
      assert.equal((await getPool().query('SELECT status FROM payments WHERE order_id = $1', [orderId])).rows[0].status, 'FAILED');
      assert.equal((await getPool().query('SELECT reserved FROM ticket_types WHERE id = $1', [ticketTypeId])).rows[0].reserved, 2);
      assert.equal((await webhook(`t=${timestamp},v1=${digest}`)).status, 200);
      assert.equal((await webhook(`t=${timestamp},v1=${digest}`)).status, 200);
      const issued = await getPool().query(
        'SELECT code FROM tickets WHERE event_id = $1 ORDER BY id', [eventId]);
      assert.equal(issued.rows.length, 2);
      assert.notEqual(issued.rows[0].code, issued.rows[1].code);
      const sold = await getPool().query('SELECT sold, reserved FROM ticket_types WHERE id = $1', [ticketTypeId]);
      assert.deepEqual([sold.rows[0].sold, sold.rows[0].reserved], [2, 0]);
      const used = await ticketService.checkIn(issued.rows[0].code, eventId, { role: 'ADMIN' });
      assert.equal(used.status, 'USED');
      await assert.rejects(() => ticketService.checkIn(issued.rows[0].code, eventId, { role: 'ADMIN' }),
        { code: 'TICKET_ALREADY_USED' });
      await assert.rejects(() => ticketService.checkIn(issued.rows[1].code, randomUUID(), { role: 'ADMIN' }),
        { code: 'WRONG_EVENT' });
      await getPool().query('UPDATE tickets SET status = $1 WHERE code = $2',
        ['CANCELLED', issued.rows[1].code]);
      await assert.rejects(() => ticketService.checkIn(issued.rows[1].code, eventId, { role: 'ADMIN' }),
        { code: 'TICKET_CANCELLED' });
      await getPool().query("UPDATE tickets SET status = 'CANCELLED' WHERE code = $1", [issued.rows[1].code]);
      await assert.rejects(() => ticketService.checkIn(issued.rows[1].code, eventId, { role: 'ADMIN' }),
        { code: 'TICKET_CANCELLED' });
      const refunded = { type: 'charge.refunded', data: { object: {
        payment_intent: paymentIntentId, amount: 2000, amount_refunded: 2000, currency: 'eur',
      } } };
      assert.equal((await sendSigned(refunded)).status, 200);
      assert.equal((await sendSigned(refunded)).status, 200);
      assert.equal((await getPool().query('SELECT status FROM orders WHERE id = $1', [orderId])).rows[0].status, 'REFUNDED');
      assert.equal((await getPool().query('SELECT status FROM payments WHERE order_id = $1', [orderId])).rows[0].status, 'REFUNDED');
      assert.equal((await getPool().query('SELECT count(*) AS total FROM tickets WHERE event_id = $1 AND status = $2',
        [eventId, 'REFUNDED'])).rows[0].total, '2');
      assert.equal((await getPool().query('SELECT sold FROM ticket_types WHERE id = $1', [ticketTypeId])).rows[0].sold, 0);
    } finally {
      [env.STRIPE_SECRET_KEY, env.STRIPE_PUBLISHABLE_KEY, env.STRIPE_WEBHOOK_SECRET] = stripeConfig;
      await getPool().query('DELETE FROM tickets WHERE event_id = $1', [eventId]);
      await getPool().query('DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE user_id = ANY($1::uuid[]))', [users]);
      await getPool().query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = ANY($1::uuid[]))', [users]);
      await getPool().query('DELETE FROM orders WHERE user_id = ANY($1::uuid[])', [users]);
      await getPool().query('DELETE FROM carts WHERE user_id = ANY($1::uuid[])', [users]);
      await getPool().query('DELETE FROM ticket_types WHERE id = $1', [ticketTypeId]);
      await getPool().query('DELETE FROM events WHERE id = $1', [eventId]);
      for (const userId of users) await getPool().query('DELETE FROM users WHERE id = $1', [userId]);
      await getPool().query('DELETE FROM venues WHERE id = $1', [venueId]);
      await new Promise((resolve) => server.close(resolve));
      await closePool();
    }
  });
