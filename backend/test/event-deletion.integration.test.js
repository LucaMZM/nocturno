import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { getPool, closePool } from '../src/config/db.js';
import { yomoganRepository } from '../src/repositories/yomogan.repository.js';

// Every write uses isolated UUID fixtures. Never depends on (or deletes) seeded data.
test('event deletion impact, history preservation and transaction integrity', {
  skip: !env.DATABASE_URL || !env.JWT_ACCESS_SECRET,
}, async (t) => {
  const pool = getPool();
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const venue = randomUUID(), promoter = randomUUID();
  const actors = { admin: randomUUID(), user: randomUUID(), outsider: randomUUID() };
  const events = [], orders = [], tokens = {};
  const call = async (id, suffix, method = 'GET', body, actor = 'admin') => {
    const response = await fetch(`${origin}/api/events/${id}/${suffix}`, {
      method,
      headers: { authorization: `Bearer ${tokens[actor]}`, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  };
  const preview = async (id) => {
    const response = await call(id, 'deletion-impact');
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.eventId, id);
    assert.equal(typeof response.body.data.analysisToken, 'string');
    assert.ok(Array.isArray(response.body.data.relations));
    return response.body.data;
  };
  const execute = (id, impact, requestId = randomUUID()) => call(id, 'deletion', 'POST', {
    analysisToken: impact.analysisToken, operation: impact.operation, requestId,
  });
  const fixture = async ({ sold = 0, reserved = 0 } = {}) => {
    const id = randomUUID(), type = randomUUID();
    events.push(id);
    await pool.query(`INSERT INTO events(id,venue_id,title,slug,event_type,starts_at,ends_at,status,is_active)
      VALUES($1,$2,$3,$4,'CLUB',NOW()+interval '2 days',NOW()+interval '3 days','PUBLISHED',TRUE)`,
    [id, venue, 'Deletion fixture ' + id, 'deletion-' + id]);
    await pool.query(`INSERT INTO ticket_types(id,event_id,name,price,quantity,sold,reserved)
      VALUES($1,$2,'General',14,20,$3,$4)`, [type, id, sold, reserved]);
    return { id, type };
  };
  const history = async (event) => {
    const order = randomUUID(), item = randomUUID(), payment = randomUUID(), ticket = randomUUID();
    orders.push(order);
    await pool.query(`INSERT INTO orders(id,user_id,status,subtotal_cents,total_cents,idempotency_key,expires_at)
      VALUES($1,$2,'PAID',1400,1400,$3,NOW()+interval '1 day')`, [order, actors.user, randomUUID()]);
    await pool.query(`INSERT INTO order_items(id,order_id,event_id,ticket_type_id,name,unit_price_cents,quantity,
      subtotal_cents,event_title_snapshot,venue_name_snapshot,starts_at_snapshot)
      VALUES($1,$2,$3,$4,'General snapshot',1400,1,1400,'Original title','Original venue',NOW())`,
    [item, order, event.id, event.type]);
    await pool.query(`INSERT INTO payments(id,order_id,provider,status,amount_cents)
      VALUES($1,$2,'STRIPE','PAID',1400)`, [payment, order]);
    await pool.query(`INSERT INTO tickets(id,order_item_id,user_id,event_id,ticket_type_id)
      VALUES($1,$2,$3,$4,$5)`, [ticket, item, actors.user, event.id, event.type]);
    return { order, item, payment, ticket };
  };
  try {
    await pool.query(`INSERT INTO venues(id,name,slug,type,province,municipality,address)
      VALUES($1,'Deletion fixture',$2,'CLUB','Fixture','DeletionCity','Fixture')`, [venue, 'delete-' + venue]);
    await pool.query(`INSERT INTO promoters(id,name,slug) VALUES($1,'Deletion outsider',$2)`, [promoter, 'delete-' + promoter]);
    for (const [name, id] of Object.entries(actors)) {
      await pool.query(`INSERT INTO users(id,email,display_name,role,promoter_id)
        VALUES($1,$2,'Deletion fixture',$3,$4)`, [id, id + '@example.com',
        { admin: 'ADMIN', user: 'USER', outsider: 'PROMOTER' }[name], name === 'outsider' ? promoter : null]);
      tokens[name] = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(id)
        .setIssuer('nocturno-api').setAudience('nocturno-web').setIssuedAt().setExpirationTime('10m')
        .sign(new TextEncoder().encode(env.JWT_ACCESS_SECRET));
    }

    await t.test('no-history delete removes operational relations and supports safe replay', async () => {
      const event = await fixture();
      await pool.query('INSERT INTO favorites(user_id,event_id) VALUES($1,$2)', [actors.user, event.id]);
      const cart = (await pool.query('INSERT INTO carts(user_id) VALUES($1) RETURNING id', [actors.user])).rows[0].id;
      await pool.query('INSERT INTO cart_items(cart_id,ticket_type_id,quantity) VALUES($1,$2,1)', [cart, event.type]);
      await pool.query('INSERT INTO event_waitlist(event_id,user_id,email) VALUES($1,$2,$3)', [event.id, actors.user, actors.user + '@example.com']);
      await pool.query("INSERT INTO event_images(event_id,url,position) VALUES($1,'https://example.com/deletion.png',0)", [event.id]);
      await yomoganRepository.cache(event.id, 'a'.repeat(64), 'b'.repeat(64), [1, 0]);
      const impact = await preview(event.id);
      assert.equal(impact.operation, 'delete');
      assert.equal(impact.recoverable, false);
      assert.deepEqual(Object.fromEntries(impact.relations.map(({ key, count }) => [key, count])), {
        ticketTypes: 1, orderItems: 0, orders: 0, payments: 0, tickets: 0,
        favorites: 1, cartItems: 1, waitlist: 1, images: 1, embeddings: 1,
      });
      const requestId = randomUUID();
      const concurrent = await Promise.all([execute(event.id, impact, requestId), execute(event.id, impact, requestId)]);
      for (const response of concurrent) assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal((await pool.query('SELECT id FROM events WHERE id=$1', [event.id])).rowCount, 0);
      for (const table of ['ticket_types', 'favorites', 'event_waitlist', 'event_images', 'yomogan_embeddings']) {
        assert.equal((await pool.query(`SELECT 1 FROM ${table} WHERE event_id=$1`, [event.id])).rowCount, 0, table);
      }
      assert.equal((await pool.query('SELECT 1 FROM cart_items WHERE cart_id=$1', [cart])).rowCount, 0);
      const replay = await execute(event.id, impact, requestId);
      assert.equal(replay.status, 200, JSON.stringify(replay.body));
      assert.equal(replay.body.data.eventId, event.id);
      assert.equal((await pool.query('SELECT 1 FROM event_deletion_audit WHERE request_id=$1', [requestId])).rowCount, 1);
      assert.equal((await call(event.id, 'deletion', 'POST', { analysisToken: impact.analysisToken, operation: impact.operation, requestId }, 'user')).status, 403);
      assert.ok([404, 409].includes((await execute(event.id, impact)).status));
    });

    await t.test('history archives without altering snapshots, payments or tickets; replay is idempotent', async () => {
      const event = await fixture({ sold: 1 });
      const refs = await history(event);
      const before = {};
      for (const [key, table] of Object.entries({ item: 'order_items', payment: 'payments', ticket: 'tickets' })) {
        before[key] = (await pool.query(`SELECT * FROM ${table} WHERE id=$1`, [refs[key]])).rows[0];
      }
      assert.ok((await yomoganRepository.candidates({ municipality: 'DeletionCity' })).some((row) => row.id === event.id));
      const impact = await preview(event.id);
      assert.equal(impact.operation, 'archive');
      assert.equal(impact.recoverable, true);
      assert.deepEqual(Object.fromEntries(impact.relations.map(({ key, count }) => [key, count])), {
        ticketTypes: 1, activeTicketTypes: 1, orderItems: 1, orders: 1, payments: 1, tickets: 1,
        favorites: 0, cartItems: 0, waitlist: 0, images: 0, embeddings: 0,
      });
      assert.ok(impact.relations.some((row) => row.count > 0 && row.action === 'preserve'));
      const requestId = randomUUID();
      assert.equal((await execute(event.id, impact, requestId)).status, 200);
      const archived = (await pool.query('SELECT status,is_active,deleted_at FROM events WHERE id=$1', [event.id])).rows[0];
      assert.equal(archived.is_active, false);
      assert.ok(archived.deleted_at);
      assert.equal(archived.status, 'PUBLISHED');
      assert.equal((await fetch(`${origin}/api/events/slug/deletion-${event.id}`)).status, 404);
      const publicResults = await (await fetch(`${origin}/api/events?search=${event.id}`)).json();
      assert.ok(!publicResults.data.some((row) => row.id === event.id));
      assert.equal((await pool.query('SELECT active FROM ticket_types WHERE id=$1', [event.type])).rows[0].active, false);
      for (const [key, table] of Object.entries({ item: 'order_items', payment: 'payments', ticket: 'tickets' })) {
        assert.deepEqual((await pool.query(`SELECT * FROM ${table} WHERE id=$1`, [refs[key]])).rows[0], before[key]);
      }
      assert.equal((await pool.query('SELECT status FROM orders WHERE id=$1', [refs.order])).rows[0].status, 'PAID');
      assert.ok(!(await yomoganRepository.candidates({ municipality: 'DeletionCity' })).some((row) => row.id === event.id));
      // An indexer that finishes after archival must not recreate retired derived data.
      await yomoganRepository.cache(event.id, 'a'.repeat(64), 'b'.repeat(64), [1, 0]);
      assert.equal((await pool.query('SELECT 1 FROM yomogan_embeddings WHERE event_id=$1', [event.id])).rowCount, 0);
      assert.equal((await execute(event.id, impact, requestId)).status, 200);
    });

    await t.test('incoherent sold or reserved counters block destructive operations', async () => {
      for (const counters of [{ sold: 1 }, { reserved: 1 }]) {
        const event = await fixture(counters);
        const impact = await preview(event.id);
        assert.equal(impact.operation, 'blocked');
        assert.ok(impact.blockers.length > 0);
        const response = await execute(event.id, { ...impact, operation: 'delete' });
        assert.equal(response.status, 409);
        assert.equal((await pool.query('SELECT is_active FROM events WHERE id=$1', [event.id])).rows[0].is_active, true);
      }
    });

    await t.test('audit failure rolls back event and ticket type archive together', async () => {
      const event = await fixture({ sold: 1 });
      await history(event);
      const impact = await preview(event.id);
      const suffix = randomUUID().replaceAll('-', '');
      const functionName = 'deletion_fail_' + suffix;
      const triggerName = 'deletion_fail_' + suffix;
      await pool.query(`CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.event_id = '${event.id}'::uuid THEN RAISE EXCEPTION 'Isolated audit failure'; END IF;
          RETURN NEW;
        END; $$`);
      try {
        await pool.query(`CREATE TRIGGER ${triggerName} BEFORE INSERT ON event_deletion_audit
          FOR EACH ROW EXECUTE FUNCTION ${functionName}()`);
        const response = await execute(event.id, impact);
        assert.equal(response.status, 500);
        const row = (await pool.query('SELECT is_active,deleted_at FROM events WHERE id=$1', [event.id])).rows[0];
        assert.equal(row.is_active, true);
        assert.equal(row.deleted_at, null);
        assert.equal((await pool.query('SELECT active FROM ticket_types WHERE id=$1', [event.type])).rows[0].active, true);
        assert.equal((await pool.query('SELECT 1 FROM event_deletion_audit WHERE event_id=$1', [event.id])).rowCount, 0);
      } finally {
        await pool.query(`DROP TRIGGER IF EXISTS ${triggerName} ON event_deletion_audit`);
        await pool.query(`DROP FUNCTION ${functionName}()`);
      }
      // The same unchanged impact remains usable once the failed transaction has rolled back.
      assert.equal((await execute(event.id, impact)).status, 200);
    });

    await t.test('a cart mutation waits for archival and cannot purchase the retired event', async () => {
      const event = await fixture();
      const transaction = await pool.connect();
      let selection;
      try {
        await transaction.query('BEGIN');
        const pid = (await transaction.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        await transaction.query('SELECT id FROM events WHERE id=$1 FOR UPDATE', [event.id]);
        await transaction.query('UPDATE events SET deleted_at=NOW(),is_active=FALSE WHERE id=$1', [event.id]);
        selection = fetch(origin + '/api/cart/items', {
          method: 'POST', headers: { authorization: `Bearer ${tokens.user}`, 'content-type': 'application/json' },
          body: JSON.stringify({ ticketTypeId: event.type, quantity: 1 }),
        });
        let blocked = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          blocked = (await pool.query(`SELECT 1 FROM pg_stat_activity
            WHERE $1=ANY(pg_blocking_pids(pid)) AND wait_event_type='Lock'`, [pid])).rowCount > 0;
          if (blocked) break;
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        assert.equal(blocked, true, 'New selections must wait on the Event lock');
        await transaction.query('COMMIT');
        assert.equal((await selection).status, 404);
        assert.equal((await pool.query('SELECT 1 FROM cart_items WHERE ticket_type_id=$1', [event.type])).rowCount, 0);
      } finally {
        await transaction.query('ROLLBACK');
        transaction.release();
        if (selection) await selection;
      }
    });

    await t.test('changed impact rejects stale confirmation and validates role/ownership', async () => {
      const event = await fixture();
      const impact = await preview(event.id);
      for (const actor of ['user', 'outsider']) {
        assert.equal((await call(event.id, 'deletion-impact', 'GET', undefined, actor)).status, 403);
        assert.equal((await call(event.id, 'deletion', 'POST', {
          operation: 'delete', requestId: randomUUID(), analysisToken: impact.analysisToken,
        }, actor)).status, 403);
      }
      await pool.query('INSERT INTO favorites(user_id,event_id) VALUES($1,$2)', [actors.user, event.id]);
      const stale = await execute(event.id, impact);
      assert.equal(stale.status, 409);
      assert.equal(stale.body.error.code, 'IMPACT_STALE');
      const sameCount = await preview(event.id);
      await pool.query('DELETE FROM favorites WHERE event_id=$1 AND user_id=$2', [event.id, actors.user]);
      await pool.query('INSERT INTO favorites(user_id,event_id) VALUES($1,$2)', [actors.outsider, event.id]);
      const swapped = await execute(event.id, sameCount);
      assert.equal(swapped.status, 409);
      assert.equal(swapped.body.error.code, 'IMPACT_STALE');
      assert.equal((await pool.query('SELECT id FROM events WHERE id=$1', [event.id])).rowCount, 1);
    });
  } finally {
    await pool.query('DELETE FROM event_deletion_audit WHERE event_id=ANY($1::uuid[])', [events]);
    await pool.query('DELETE FROM tickets WHERE event_id=ANY($1::uuid[])', [events]);
    await pool.query('DELETE FROM payments WHERE order_id=ANY($1::uuid[])', [orders]);
    await pool.query('DELETE FROM order_items WHERE event_id=ANY($1::uuid[])', [events]);
    await pool.query('DELETE FROM orders WHERE id=ANY($1::uuid[])', [orders]);
    await pool.query('DELETE FROM events WHERE id=ANY($1::uuid[])', [events]);
    await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [Object.values(actors)]);
    await pool.query('DELETE FROM promoters WHERE id=$1', [promoter]);
    await pool.query('DELETE FROM venues WHERE id=$1', [venue]);
    await new Promise((resolve) => server.close(resolve));
    await closePool();
  }
});
