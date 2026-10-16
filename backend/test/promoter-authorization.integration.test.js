import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { getPool, closePool } from '../src/config/db.js';
import { hashPassword } from '../src/utils/password.js';

test('isolated PROMOTER can manage only owned events and sees scoped dashboard',
  { skip: !env.DATABASE_URL }, async () => {
    const [ownPromoter, otherPromoter, venueId, ownEvent, otherEvent, userId] =
      Array.from({ length: 6 }, () => randomUUID());
    let createdEvent;
    const email = `promoter-fixture-${userId}@example.com`;
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (path, token, method = 'GET', body) => {
      const response = await fetch(base + path, { method, headers: {
        'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, body: await response.json() };
    };
    try {
      for (const [promoterId, name] of [[ownPromoter, 'Fixture owner'], [otherPromoter, 'Fixture foreign']])
        await getPool().query('INSERT INTO promoters (id,name,slug) VALUES ($1,$2,$3)',
          [promoterId,name,`fixture-${promoterId}`]);
      await getPool().query(`INSERT INTO venues (id,name,slug,type,province,municipality,address)
        VALUES ($1,'Fixture venue',$2,'CLUB','Valencia','Valencia','Fixture street')`,
        [venueId,`fixture-${venueId}`]);
      for (const [eventId, promoterId, suffix] of [[ownEvent,ownPromoter,'own'],[otherEvent,otherPromoter,'other']])
        await getPool().query(`INSERT INTO events
          (id,venue_id,promoter_id,title,slug,event_type,starts_at,ends_at,status)
          VALUES ($1,$2,$3,$4,$5,'CLUB',NOW()+INTERVAL '3 days',NOW()+INTERVAL '3 days 5 hours','PUBLISHED')`,
          [eventId,venueId,promoterId,`Fixture ${suffix}`,`fixture-${suffix}-${eventId}`]);
      await getPool().query(`INSERT INTO users (id,email,display_name,role,promoter_id,password_hash)
        VALUES ($1,$2,'Fixture promoter','PROMOTER',$3,$4)`,
        [userId,email,ownPromoter,await hashPassword('FixturePassword!2026')]);
      const login = await request('/api/auth/login',null,'POST',{ email,password:'FixturePassword!2026' });
      assert.equal(login.status,200);
      const token = login.body.data.accessToken;
      const publicProfile = await request(`/api/promoters/slug/fixture-${ownPromoter}`, null);
      assert.equal(publicProfile.status, 200);
      assert.equal(publicProfile.body.data.promoter.id, ownPromoter);
      assert.deepEqual(publicProfile.body.data.upcomingEvents.map((event) => event.id), [ownEvent]);
      const list = await request('/api/dashboard/events',token);
      assert.equal(list.status,200);
      assert.deepEqual(list.body.data.map((event)=>event.id),[ownEvent]);
      assert.equal((await request('/api/dashboard',token)).body.data.events,1);
      assert.equal((await request(`/api/events/${otherEvent}`,token)).status,403);
      assert.equal((await request(`/api/events/${otherEvent}`,token,'PATCH',{title:'Tampered'})).status,403);
      assert.equal((await getPool().query('SELECT title FROM events WHERE id=$1',[otherEvent])).rows[0].title,'Fixture other');
      const ownChange = await request(`/api/events/${ownEvent}`,token,'PATCH',{title:'Fixture Propio Nuevo'});
      assert.equal(ownChange.status,200);
      assert.equal(ownChange.body.data.slug,'fixture-propio-nuevo');
      const startsAt = new Date(Date.now()+5*86400000).toISOString();
      const endsAt = new Date(Date.now()+5*86400000+4*3600000).toISOString();
      const created = await request('/api/events',token,'POST',{ venueId,promoterId:otherPromoter,
        title:`Fixture creado ${userId}`,eventType:'CLUB',startsAt,endsAt,
        musicGenres:['TECHNO'],atmosphere:['UNDERGROUND'],idealFor:[],status:'DRAFT',isActive:true });
      assert.equal(created.status,201);
      createdEvent = created.body.data.id;
      assert.equal(created.body.data.promoterId,ownPromoter);
      assert.equal((await request('/api/payments',token)).status,403);
    } finally {
      if (createdEvent) await getPool().query('DELETE FROM events WHERE id=$1',[createdEvent]);
      await getPool().query('DELETE FROM users WHERE id=$1',[userId]);
      await getPool().query('DELETE FROM events WHERE id=ANY($1::uuid[])',[[ownEvent,otherEvent]]);
      await getPool().query('DELETE FROM venues WHERE id=$1',[venueId]);
      await getPool().query('DELETE FROM promoters WHERE id=ANY($1::uuid[])',[[ownPromoter,otherPromoter]]);
      await new Promise((resolve)=>server.close(resolve));
      await closePool();
    }
  });
