import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { getPool, closePool } from '../src/config/db.js';
import { hashPassword } from '../src/utils/password.js';

test('active, inactive and deleted Event views preserve the restore invariant',
  { skip: !env.DATABASE_URL }, async () => {
    const venueId = randomUUID();
    const adminId = randomUUID();
    const eventIds = [];
    const marker = `Restore ${randomUUID().slice(0, 8)}`;
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    let token;
    const call = async (path, method = 'GET', body) => {
      const response = await fetch(origin + path, { method, headers: {
        'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, body: response.status === 204 ? null : await response.json() };
    };
    const ids = async (path) => (await call(path)).body.data.map((event) => event.id);
    const manage = (deleted = 'exclude', active = 'all', extra = '') =>
      `/api/dashboard/events?search=${encodeURIComponent(marker)}&deleted=${deleted}&active=${active}${extra}`;
    try {
      await getPool().query(`INSERT INTO venues (id,name,slug,type,province,municipality,address)
        VALUES ($1,'Restore fixture',$2,'CLUB','Valencia','Valencia','Fixture street')`,
        [venueId, `restore-${venueId}`]);
      const email = `restore-${adminId}@example.com`;
      await getPool().query(`INSERT INTO users (id,email,display_name,role,password_hash)
        VALUES ($1,$2,'Restore admin','ADMIN',$3)`,
      [adminId,email,await hashPassword('RestoreFixture!2026')]);
      const login = await call('/api/auth/login', 'POST', { email, password: 'RestoreFixture!2026' });
      assert.equal(login.status, 200);
      token = login.body.data.accessToken;
      const base = { venueId, eventType: 'CLUB', status: 'PUBLISHED',
        startsAt: '2027-02-01T22:00:00+01:00', endsAt: '2027-02-02T04:00:00+01:00' };
      for (const [suffix, isActive] of [['A',true],['B',false],['C',true]]) {
        const created = await call('/api/events', 'POST', { ...base, title: `${marker} ${suffix}`, isActive });
        assert.equal(created.status, 201, JSON.stringify(created.body));
        eventIds.push(created.body.data.id);
      }
      const [a,b,c] = eventIds;
      assert.deepEqual((await getPool().query('SELECT deleted_at,is_active FROM events WHERE id=$1',[c])).rows[0],
        { deleted_at: null, is_active: true });
      const deleted = await call(`/api/events/${c}/soft-delete`, 'PATCH');
      assert.equal(deleted.status, 200);
      assert.equal(deleted.body.data.status, 'PUBLISHED');
      assert.equal(deleted.body.data.isActive, false);
      assert.ok(deleted.body.data.deletedAt);
      assert.ok(deleted.body.data.updatedAt);
      assert.equal((await call(`/api/events/${c}`, 'PATCH', { isActive: true })).status, 409);
      assert.equal((await call(`/api/events/${c}/active`, 'PATCH', { isActive: true })).status, 409);
      await assert.rejects(getPool().query('UPDATE events SET is_active=TRUE WHERE id=$1',[c]),
        { code: '23514', constraint: 'events_deleted_inactive_check' });
      assert.equal((await call(`/api/events/slug/${deleted.body.data.slug}`)).status, 404);
      for (const extra of ['', '&genre=TECHNO', '&page=1&limit=1'])
        assert.ok(!(await ids(`/api/events?search=${encodeURIComponent(marker)}${extra}`)).includes(c));
      assert.deepEqual(new Set(await ids(manage())), new Set([a,b]));
      assert.deepEqual(await ids(manage('exclude','true')), [a]);
      assert.deepEqual(await ids(manage('exclude','false')), [b]);
      assert.deepEqual(await ids(manage('only')), [c]);
      assert.equal((await call(manage('only','true'))).status, 400);
      assert.equal((await call(manage('exclude','all','&limit=1'))).body.pagination.total, 2);
      const restored = await call(`/api/events/${c}/restore`, 'PATCH');
      assert.equal(restored.status, 200);
      assert.equal(restored.body.data.deletedAt, null);
      assert.equal(restored.body.data.isActive, false);
      assert.equal(restored.body.data.status, 'PUBLISHED');
      assert.ok(restored.body.data.updatedAt);
      assert.deepEqual(new Set(await ids(manage())), new Set([a,b,c]));
      assert.deepEqual(new Set(await ids(manage('exclude','false'))), new Set([b,c]));
      assert.deepEqual(await ids(manage('only')), []);
      assert.equal((await call(`/api/events/slug/${restored.body.data.slug}`)).status, 404);
      const activated = await call(`/api/events/${c}/active`, 'PATCH', { isActive: true });
      assert.equal(activated.status, 200);
      assert.equal(activated.body.data.deletedAt, null);
      assert.equal(activated.body.data.isActive, true);
      assert.deepEqual(new Set(await ids(manage('exclude','true'))), new Set([a,c]));
      assert.deepEqual(await ids(manage('exclude','false')), [b]);
      assert.deepEqual(await ids(manage('only')), []);
      assert.equal((await call(`/api/events/slug/${restored.body.data.slug}`)).status, 200);
    } finally {
      for (const eventId of eventIds) await getPool().query('DELETE FROM events WHERE id=$1',[eventId]);
      await getPool().query('DELETE FROM users WHERE id=$1',[adminId]);
      await getPool().query('DELETE FROM venues WHERE id=$1',[venueId]);
      await new Promise((resolve) => server.close(resolve));
      await closePool();
    }
  });
