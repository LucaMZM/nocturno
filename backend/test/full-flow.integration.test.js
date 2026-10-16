import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { getPool, closePool } from '../src/config/db.js';
import { hashPassword } from '../src/utils/password.js';

test('HTTP flow: admin publishes, user favorites and buys two free tickets, admin checks in',
  { skip: !env.DATABASE_URL }, async () => {
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const adminId = randomUUID();
    let userId, venueId, eventId, ticketTypeId, orderId;
    const request = async (path, method = 'GET', body, token, headers = {}) => {
      const response = await fetch(origin + path, {
        method, headers: { 'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
      return { status: response.status, body: response.status === 204 ? null : await response.json() };
    };
    try {
      const adminEmail = `admin-${adminId}@example.com`;
      await getPool().query(`INSERT INTO users (id,email,display_name,role,password_hash)
        VALUES ($1,$2,'Flow admin','ADMIN',$3)`, [adminId, adminEmail, await hashPassword('flow-password-123')]);
      const adminLogin = await request('/api/auth/login', 'POST',
        { email: adminEmail, password: 'flow-password-123' });
      assert.equal(adminLogin.status, 200);
      const adminToken = adminLogin.body.data.accessToken;

      const registered = await request('/api/auth/register', 'POST',
        { email: `buyer-${randomUUID()}@example.com`, password: 'buyer-password-123', displayName: 'Flow buyer' });
      assert.equal(registered.status, 201);
      userId = registered.body.data.user.id;
      const buyerToken = registered.body.data.accessToken;
      const venue = await request('/api/venues', 'POST', { name: 'Flow venue', type: 'CLUB',
        province: 'Valencia', municipality: 'Valencia', address: 'Flow street' }, adminToken);
      assert.equal(venue.status, 201);
      venueId = venue.body.data.id;
      const venueSlug = venue.body.data.slug;
      assert.ok(venueSlug);
      const created = await request('/api/events', 'POST', { venueId, title: `Flow ${randomUUID().slice(0, 8)}`,
        eventType: 'CLUB', startsAt: '2027-06-01T22:00:00+02:00',
        endsAt: '2027-06-02T04:00:00+02:00', status: 'PUBLISHED',
        musicGenres: ['TECHNO'], atmosphere: ['UNDERGROUND'] }, adminToken);
      assert.equal(created.status, 201);
      eventId = created.body.data.id;
      const slug = created.body.data.slug;
      const ticketType = await request(`/api/events/${eventId}/ticket-types`, 'POST',
        { name: 'Gratis', price: 0, quantity: 5, maxPerUser: 2 }, adminToken);
      assert.equal(ticketType.status, 201);
      ticketTypeId = ticketType.body.data.id;
      const publicList = await request('/api/events?municipality=Valencia&genre=TECHNO&atmosphere=UNDERGROUND');
      assert.equal(publicList.status, 200);
      assert.ok(publicList.body.data.some((event) => event.id === eventId));
      assert.equal((await request(`/api/events/slug/${slug}`)).status, 200);
      const venueProfile = await request(`/api/venues/slug/${venueSlug}`);
      assert.equal(venueProfile.status, 200);
      assert.ok(venueProfile.body.data.upcomingEvents.some((event) => event.id === eventId));
      assert.equal((await request('/api/dashboard', 'GET', undefined, buyerToken)).status, 403);
      assert.equal((await request(`/api/me/favorites/${eventId}`, 'POST', undefined, buyerToken)).status, 201);
      assert.ok((await request('/api/me/favorites', 'GET', undefined, buyerToken))
        .body.data.some((event) => event.id === eventId));
      const added = await request('/api/cart/items', 'POST', { ticketTypeId, quantity: 2 }, buyerToken);
      assert.equal(added.status, 201);
      assert.equal(added.body.data.totalCents, 0);
      const idempotencyKey = randomUUID();
      const checkout = await request('/api/checkout', 'POST', { totalCents: 1 }, buyerToken,
        { 'Idempotency-Key': idempotencyKey });
      assert.equal(checkout.status, 200, JSON.stringify(checkout.body));
      assert.equal(checkout.body.data.order.status, 'PAID');
      assert.equal(checkout.body.data.order.totalCents, 0);
      orderId = checkout.body.data.order.id;
      assert.equal((await request('/api/checkout', 'POST', {}, buyerToken,
        { 'Idempotency-Key': idempotencyKey })).body.data.order.id, orderId);
      const order = (await request(`/api/orders/${orderId}`, 'GET', undefined, buyerToken)).body.data;
      assert.equal(order.status, 'PAID');
      assert.equal(order.items[0].eventTitle, created.body.data.title);
      assert.equal(order.items[0].venueName, venue.body.data.name);
      assert.equal(order.tickets.length, 2);
      const tickets = await request('/api/tickets', 'GET', undefined, buyerToken);
      const issued = tickets.body.data.filter((ticket) => ticket.eventId === eventId);
      assert.equal(issued.length, 2);
      assert.notEqual(issued[0].code, issued[1].code);
      assert.match(issued[0].code, /^[0-9a-f]{8}-[0-9a-f-]{27,}$/);
      assert.equal((await request(`/api/tickets/${issued[0].id}`, 'GET', undefined, buyerToken)).status, 200);
      assert.equal((await request(`/api/events/${eventId}/attendees?search=${encodeURIComponent(issued[0].code)}`, 'GET', undefined, adminToken)).body.data.length, 1);
      const summary = await request('/api/dashboard', 'GET', undefined, adminToken);
      assert.equal(summary.status, 200);
      assert.ok(Array.isArray(summary.body.data.topEvents));
      assert.equal(summary.body.data.salesTrend.length, 30);
      const topByTickets = await request('/api/dashboard/top-events?sort=tickets', 'GET', undefined, adminToken);
      assert.equal(topByTickets.status, 200);
      assert.ok(topByTickets.body.data.every((event, index, rows) =>
        index === 0 || rows[index - 1].ticketsSold >= event.ticketsSold));
      assert.equal((await request(`/api/events/${eventId}/check-in`, 'GET', undefined, adminToken)).body.data.pending, 2);
      assert.equal((await request(`/api/tickets/${issued[0].code}/check-in`, 'POST',
        { eventId }, adminToken)).body.data.status, 'USED');
      assert.equal((await request(`/api/tickets/${issued[0].code}/check-in`, 'POST',
        { eventId }, adminToken)).status, 409);
      assert.equal((await request(`/api/events/${eventId}/check-in`, 'GET', undefined, adminToken)).body.data.used, 1);
      assert.equal((await request(`/api/events/${eventId}/waitlist`, 'POST', {}, buyerToken)).status, 409);
      await getPool().query('UPDATE ticket_types SET quantity = sold + reserved WHERE id = $1', [ticketTypeId]);
      assert.equal((await request(`/api/events/${eventId}`, 'PATCH', { status: 'SOLD_OUT' }, adminToken)).status, 200);
      assert.ok((await request(`/api/events?municipality=Valencia&search=${encodeURIComponent(created.body.data.title)}`)).body.data.some((event) => event.id === eventId));
      assert.equal((await request(`/api/events/${eventId}/waitlist`, 'POST', {}, buyerToken)).status, 201);
      assert.equal((await request(`/api/events/${eventId}/waitlist`, 'POST', {}, buyerToken)).status, 201);
      assert.equal((await request(`/api/events/${eventId}/waitlist`, 'GET', undefined, buyerToken)).body.data.joined, true);
      assert.equal((await getPool().query('SELECT count(*)::integer AS count FROM event_waitlist WHERE event_id = $1', [eventId])).rows[0].count, 1);
      assert.equal((await request(`/api/events/${eventId}/waitlist`, 'POST', {}, undefined)).status, 401);
      assert.equal((await request(`/api/events/${eventId}`, 'PATCH', { status: 'CANCELLED' }, adminToken)).status, 200);
      const historicalOrder = await request(`/api/orders/${orderId}`, 'GET', undefined, buyerToken);
      assert.equal(historicalOrder.status, 200);
      assert.equal(historicalOrder.body.data.items[0].eventTitle, created.body.data.title);
      assert.equal(historicalOrder.body.data.tickets.length, 2);
      assert.equal((await request(`/api/orders?eventId=${eventId}`, 'GET', undefined, adminToken))
        .body.data.some((item) => item.id === orderId), true);
      assert.equal((await request(`/api/events/${eventId}/soft-delete`, 'PATCH', undefined, adminToken)).status, 200);
      assert.equal((await request(`/api/events/slug/${slug}`)).status, 404);
    } finally {
      if (eventId) await getPool().query('DELETE FROM tickets WHERE event_id = $1', [eventId]);
      if (orderId) {
        await getPool().query('DELETE FROM payments WHERE order_id = $1', [orderId]);
        await getPool().query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
        await getPool().query('DELETE FROM orders WHERE id = $1', [orderId]);
      }
      if (userId) await getPool().query('DELETE FROM carts WHERE user_id = $1', [userId]);
      if (ticketTypeId) await getPool().query('DELETE FROM ticket_types WHERE id = $1', [ticketTypeId]);
      if (eventId) await getPool().query('DELETE FROM events WHERE id = $1', [eventId]);
      if (userId) await getPool().query('DELETE FROM users WHERE id = $1', [userId]);
      await getPool().query('DELETE FROM users WHERE id = $1', [adminId]);
      if (venueId) await getPool().query('DELETE FROM venues WHERE id = $1', [venueId]);
      await new Promise((resolve) => server.close(resolve));
      await closePool();
    }
  });
