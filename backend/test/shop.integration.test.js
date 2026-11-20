import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { getPool, closePool } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { buildEventListQuery } from '../src/repositories/event.repository.js';

test('Shop parametriza búsqueda y combina restricciones antes de paginar', () => {
  const query = buildEventListQuery({ search: "'; DROP TABLE events; --", genre: 'TECHNO',
    municipality: 'Valencia', minPrice: 10, maxPrice: 20, page: 2, limit: 5, sort: 'price' });
  assert.ok(!query.sql.includes('DROP TABLE'));
  assert.ok(query.values.includes("%'; DROP TABLE events; --%"));
  assert.ok(query.sql.includes('e.deleted_at IS NULL'));
  assert.ok(query.countSql.includes('e.deleted_at IS NULL'));
  assert.deepEqual(query.values.slice(-2), [5, 5]);
});

test('Shop: seis endpoints, facetas, filtros, variantes y compatibilidad', { skip: !env.DATABASE_URL }, async () => {
  const db = getPool(), venue = randomUUID(), host = randomUUID();
  const events = Array.from({ length: 4 }, () => randomUUID());
  const marker = 'shop-' + randomUUID();
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const call = async (path) => {
    const res = await fetch(base + path);
    return { status: res.status, ...await res.json() };
  };
  try {
    await db.query("INSERT INTO venues(id,name,slug,type,province,municipality,address) VALUES($1,$2,$2,'CLUB','Valencia','Valencia','Fixture')", [venue,marker]);
    await db.query('INSERT INTO promoters(id,name,slug) VALUES($1,$2,$2)', [host,marker]);
    for (let i=0;i<4;i++) await db.query(`INSERT INTO events(id,venue_id,promoter_id,title,slug,event_type,starts_at,ends_at,status,is_active,deleted_at,music_genres)
      VALUES($1,$2,$3,$4,$4,'CLUB',NOW()+interval '2 days',NOW()+interval '3 days',$5,$6,$7,ARRAY['TECHNO'])`,
      [events[i],venue,host,marker+'-'+i,i===3?'DRAFT':'PUBLISHED',i<2,i===2?new Date():null]);
    for (let i=0;i<2;i++) await db.query(`INSERT INTO ticket_types(event_id,name,price,quantity,sold,reserved,active)
      VALUES($1,'General',$2,10,2,1,true)`, [events[i],10+i*10]);
    const prefix = '/api/shop';
    for (const resource of ['categories','hosts','locations']) {
      const result = await call(prefix+'/'+resource);
      assert.equal(result.status,200);
      assert.ok(result.data.some(row => row.id === ({ categories:'TECHNO',hosts:host,locations:venue })[resource]));
      assert.ok(result.data.every(row => row.email === undefined && row.phone === undefined));
    }
    const filters = '?promoterId='+host+'&genre=TECHNO&municipality=Valencia&search='+marker;
    const list = await call(prefix+'/events'+filters+'&limit=1&sort=price');
    assert.equal(list.pagination.total,2);
    assert.equal(list.data[0].id,events[0]);
    assert.equal((await call(prefix+'/events'+filters+'&page=2&limit=1&sort=price')).data[0].id,events[1]);
    assert.equal((await call(prefix+'/events'+filters+'&maxPrice=15')).pagination.total,1);
    assert.equal((await call(prefix+'/events?promoterId='+randomUUID())).pagination.total,0);
    assert.equal((await call(prefix+'/events?genre=INVENTADO')).status,400);
    assert.equal((await call(prefix+'/events?page=-1')).status,400);
    const detail = await call(prefix+'/events/'+marker+'-0');
    assert.equal(detail.data.id,events[0]);
    const variants = await call(prefix+'/events/'+marker+'-0/variants');
    assert.equal(variants.data[0].available,7);
    assert.equal(variants.data[0].purchasable,true);
    for (const i of [2,3]) {
      assert.equal((await call(prefix+'/events/'+marker+'-'+i)).status,404);
      assert.equal((await call(prefix+'/events/'+marker+'-'+i+'/variants')).status,404);
    }
    assert.deepEqual((await call('/api/events'+filters)).data,(await call(prefix+'/events'+filters)).data);
  } finally {
    await db.query('DELETE FROM ticket_types WHERE event_id=ANY($1::uuid[])',[events]);
    await db.query('DELETE FROM events WHERE id=ANY($1::uuid[])',[events]);
    await db.query('DELETE FROM promoters WHERE id=$1',[host]);
    await db.query('DELETE FROM venues WHERE id=$1',[venue]);
    await new Promise(resolve => server.close(resolve));
    await closePool();
  }
});
