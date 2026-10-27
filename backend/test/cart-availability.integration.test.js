import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { env } from '../src/config/env.js';
import { getPool, closePool } from '../src/config/db.js';
import { cartService } from '../src/services/cart.service.js';

test('cart reports real availability, price and image without deleting stale selections', { skip: !env.DATABASE_URL }, async () => {
  const pool = getPool();
  const [user, venue, event, type] = Array.from({ length: 4 }, () => randomUUID());
  try {
    await pool.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Cart fixture')", [user,user+'@example.test']);
    await pool.query("INSERT INTO venues(id,name,slug,type,province,municipality,address) VALUES($1,'Cart venue',$2,'CLUB','Valencia','Valencia','Fixture')", [venue,venue]);
    await pool.query("INSERT INTO events(id,venue_id,title,slug,event_type,starts_at,ends_at,status,poster_url) VALUES($1,$2,'Cart night',$3,'CLUB',NOW()+interval '1 day',NOW()+interval '2 days','PUBLISHED','/posters/event-01.svg')", [event,venue,'cart-'+event]);
    await pool.query("INSERT INTO ticket_types(id,event_id,name,price,quantity,max_per_user) VALUES($1,$2,'General',14,6,6)", [type,event]);
    let cart = await cartService.addItem(user,{ ticketTypeId:type,quantity:2 });
    assert.equal(cart.totalCents,2800);
    assert.equal(cart.items[0].purchasable,true);
    assert.equal(cart.items[0].imageUrl,'/posters/event-01.svg');
    await pool.query('UPDATE ticket_types SET price=15,quantity=1 WHERE id=$1',[type]);
    cart = await cartService.getCart(user);
    assert.equal(cart.totalCents,3000);
    assert.equal(cart.items[0].quantity,2);
    assert.equal(cart.items[0].unavailableReason,'OUT_OF_STOCK');
    assert.equal(cart.items[0].purchasable,false);
    await assert.rejects(() => cartService.updateItem(user,cart.items[0].id,3),{code:'OUT_OF_STOCK'});
    cart = await cartService.updateItem(user,cart.items[0].id,1);
    assert.equal(cart.items[0].purchasable,true);
    await pool.query("UPDATE ticket_types SET sales_end=NOW()-interval '1 minute' WHERE id=$1",[type]);
    assert.equal((await cartService.getCart(user)).items[0].unavailableReason,'SALES_ENDED');
    await pool.query('UPDATE ticket_types SET sales_end=NULL WHERE id=$1',[type]);
    for (const change of ["status='CANCELLED'", "status='PUBLISHED',is_active=FALSE", "deleted_at=NOW()", "deleted_at=NULL,starts_at=NOW()-interval '2 days',ends_at=NOW()-interval '1 day'"]) {
      await pool.query(`UPDATE events SET ${change} WHERE id=$1`,[event]);
      cart = await cartService.getCart(user);
      assert.equal(cart.items.length,1);
      assert.equal(cart.items[0].purchasable,false);
    }
    assert.equal((await cartService.removeItem(user,cart.items[0].id)).items.length,0);
  } finally {
    await pool.query('DELETE FROM users WHERE id=$1',[user]);
    await pool.query('DELETE FROM events WHERE id=$1',[event]);
    await pool.query('DELETE FROM venues WHERE id=$1',[venue]);
    await closePool();
  }
});
