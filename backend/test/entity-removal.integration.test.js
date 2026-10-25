import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getPool, closePool } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { venueService } from '../src/services/venue.service.js';
import { promoterService } from '../src/services/promoter.service.js';
import { userService } from '../src/services/user.service.js';
import { ticketTypeService } from '../src/services/ticket-type.service.js';

test('entity removals preserve history and ownership, expose counts, and delete only unused resources',
  { skip: !env.DATABASE_URL }, async () => {
    const pool = getPool();
    const ids = Object.fromEntries(['venue','promoter','owner','buyer','event','type','order','item','payment','ticket','cart']
      .map((name) => [name, randomUUID()]));
    async function blocked(operation, code, counts) {
      await assert.rejects(operation, (error) => {
        assert.equal(error.status, 409);
        assert.equal(error.code, code);
        assert.deepEqual(error.details.dependencies, counts);
        assert.ok(error.details.recommendation);
        return true;
      });
    }
    try {
      await pool.query(`INSERT INTO venues (id,name,slug,type,province,municipality,address)
        VALUES ($1,'Removal fixture',$2,'CLUB','Valencia','Valencia','Fixture')`, [ids.venue, `removal-${ids.venue}`]);
      await pool.query(`INSERT INTO promoters (id,name,slug) VALUES ($1,'Removal promoter',$2)`,
        [ids.promoter, `removal-${ids.promoter}`]);
      await pool.query(`INSERT INTO users (id,email,display_name,role,promoter_id)
        VALUES ($1,$2,'Removal owner','PROMOTER',$3), ($4,$5,'Removal buyer','USER',NULL)`,
        [ids.owner, `${ids.owner}@example.com`, ids.promoter, ids.buyer, `${ids.buyer}@example.com`]);
      await pool.query(`INSERT INTO events (id,venue_id,promoter_id,title,slug,event_type,starts_at,ends_at,status)
        VALUES ($1,$2,$3,'Removal fixture',$4,'CLUB',NOW()+INTERVAL '1 day',NOW()+INTERVAL '2 days','PUBLISHED')`,
        [ids.event, ids.venue, ids.promoter, `removal-${ids.event}`]);
      await pool.query(`INSERT INTO ticket_types (id,event_id,name,price,quantity,sold)
        VALUES ($1,$2,'General',10,5,1)`, [ids.type, ids.event]);
      await blocked(() => venueService.remove(ids.venue), 'VENUE_HAS_DEPENDENCIES', { events: 1 });
      await blocked(() => promoterService.remove(ids.promoter), 'PROMOTER_HAS_DEPENDENCIES', { events: 1, users: 1 });
      await blocked(() => ticketTypeService.remove(ids.type), 'TICKET_TYPE_HAS_DEPENDENCIES',
        { order_items: 0, tickets: 0, sold: 1, reserved: 0 });
      await pool.query('UPDATE ticket_types SET sold=0,reserved=1 WHERE id=$1', [ids.type]);
      await blocked(() => ticketTypeService.remove(ids.type), 'TICKET_TYPE_HAS_DEPENDENCIES',
        { order_items: 0, tickets: 0, sold: 0, reserved: 1 });
      await pool.query('UPDATE ticket_types SET sold=1,reserved=0 WHERE id=$1', [ids.type]);
      await pool.query(`INSERT INTO orders (id,user_id,status,subtotal_cents,total_cents,idempotency_key,expires_at)
        VALUES ($1,$2,'PAID',1000,1000,$3,NOW()+INTERVAL '1 day')`, [ids.order, ids.buyer, randomUUID()]);
      await pool.query(`INSERT INTO order_items (id,order_id,event_id,ticket_type_id,name,unit_price_cents,quantity,
        subtotal_cents,event_title_snapshot,venue_name_snapshot,starts_at_snapshot)
        VALUES ($1,$2,$3,$4,'General',1000,1,1000,'Historic event','Historic venue',NOW())`,
        [ids.item, ids.order, ids.event, ids.type]);
      await pool.query(`INSERT INTO payments(id,order_id,provider,status,amount_cents)
        VALUES ($1,$2,'STRIPE','PAID',1000)`, [ids.payment, ids.order]);
      await pool.query(`INSERT INTO tickets(id,order_item_id,user_id,event_id,ticket_type_id)
        VALUES ($1,$2,$3,$4,$5)`, [ids.ticket, ids.item, ids.buyer, ids.event, ids.type]);
      await blocked(() => userService.remove(ids.buyer), 'USER_HAS_DEPENDENCIES', { orders: 1, tickets: 1 });
      await blocked(() => ticketTypeService.remove(ids.type), 'TICKET_TYPE_HAS_DEPENDENCIES',
        { order_items: 1, tickets: 1, sold: 1, reserved: 0 });
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM tickets WHERE id=$1', [ids.ticket])).rows[0].n, 1);
      assert.equal((await pool.query('SELECT promoter_id FROM users WHERE id=$1', [ids.owner])).rows[0].promoter_id, ids.promoter);
      // Remove only this test's historical fixtures explicitly; domain operations never do it.
      await pool.query('DELETE FROM tickets WHERE id=$1', [ids.ticket]);
      await pool.query('DELETE FROM payments WHERE id=$1', [ids.payment]);
      await pool.query('DELETE FROM order_items WHERE id=$1', [ids.item]);
      await pool.query('DELETE FROM orders WHERE id=$1', [ids.order]);
      await pool.query('UPDATE ticket_types SET sold=0 WHERE id=$1', [ids.type]);
      await pool.query('INSERT INTO carts(id,user_id) VALUES($1,$2)', [ids.cart, ids.buyer]);
      await pool.query('INSERT INTO cart_items(cart_id,ticket_type_id,quantity) VALUES($1,$2,1)', [ids.cart, ids.type]);
      await ticketTypeService.remove(ids.type);
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM cart_items WHERE cart_id=$1', [ids.cart])).rows[0].n, 0);
      await pool.query('INSERT INTO favorites(user_id,event_id) VALUES($1,$2)', [ids.buyer, ids.event]);
      await userService.remove(ids.buyer);
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM carts WHERE id=$1', [ids.cart])).rows[0].n, 0);
      await pool.query('DELETE FROM events WHERE id=$1', [ids.event]);
      await blocked(() => promoterService.remove(ids.promoter), 'PROMOTER_HAS_DEPENDENCIES', { events: 0, users: 1 });
      await userService.remove(ids.owner);
      await promoterService.remove(ids.promoter);
      await venueService.remove(ids.venue);
      for (const [service, id] of [[venueService,ids.venue],[promoterService,ids.promoter],[userService,ids.owner],[ticketTypeService,ids.type]])
        await assert.rejects(() => service.remove(id), { status: 404 });
    } finally {
      await pool.query('DELETE FROM tickets WHERE id=$1', [ids.ticket]);
      await pool.query('DELETE FROM payments WHERE id=$1', [ids.payment]);
      await pool.query('DELETE FROM order_items WHERE id=$1', [ids.item]);
      await pool.query('DELETE FROM orders WHERE id=$1', [ids.order]);
      await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [[ids.owner,ids.buyer]]);
      await pool.query('DELETE FROM ticket_types WHERE id=$1', [ids.type]);
      await pool.query('DELETE FROM events WHERE id=$1', [ids.event]);
      await pool.query('DELETE FROM promoters WHERE id=$1', [ids.promoter]);
      await pool.query('DELETE FROM venues WHERE id=$1', [ids.venue]);
      await closePool();
    }
  });

test('parent locking waits for new ownership then blocks promoter deletion without clearing the owner',
  { skip: !env.DATABASE_URL }, async () => {
    const pool = getPool();
    const promoterId = randomUUID();
    const ownerId = randomUUID();
    const locker = await pool.connect();
    try {
      await pool.query('INSERT INTO promoters(id,name,slug) VALUES($1,$2,$3)',
        [promoterId,'Ownership race fixture',`race-${promoterId}`]);
      await locker.query('BEGIN');
      await locker.query('SELECT id FROM promoters WHERE id=$1 FOR UPDATE', [promoterId]);
      const deletion = assert.rejects(() => promoterService.remove(promoterId), { code: 'PROMOTER_HAS_DEPENDENCIES' });
      await locker.query(`INSERT INTO users(id,email,display_name,role,promoter_id)
        VALUES($1,$2,'Concurrent owner','PROMOTER',$3)`, [ownerId,`${ownerId}@example.com`,promoterId]);
      await locker.query('COMMIT');
      await deletion;
      assert.equal((await pool.query('SELECT promoter_id FROM users WHERE id=$1', [ownerId])).rows[0].promoter_id, promoterId);
    } finally {
      await locker.query('ROLLBACK');
      locker.release();
      await pool.query('DELETE FROM users WHERE id=$1', [ownerId]);
      await pool.query('DELETE FROM promoters WHERE id=$1', [promoterId]);
      await closePool();
    }
  });
