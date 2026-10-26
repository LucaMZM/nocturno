import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { getPool, closePool } from '../src/config/db.js';

// UUID fixtures only; no seed, schema changes or writes to other users.
test('Profile is separate from sessions and admin Users, with safe legacy aliases',
  { skip: !env.DATABASE_URL }, async () => {
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const ids = [];
    async function call(path, { method = 'GET', body, token, cookie } = {}) {
      const response = await fetch(origin + '/api' + path, { method,
        headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}), ...(cookie ? { cookie } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, cookie: response.headers.get('set-cookie'),
        data: response.status === 204 ? null : await response.json() };
    }
    try {
      const email = `profile-${randomUUID()}@example.test`, password = 'ProfileFixture!2026';
      assert.equal((await call('/auth/register', { method: 'POST', body: { email, password, displayName: 'Original', role: 'ADMIN' } })).status, 400);
      const register = await call('/auth/register', { method: 'POST', body: { email, password, displayName: 'Original' } });
      assert.equal(register.status, 201);
      const session = register.data.data;
      ids.push(session.user.id);
      assert.equal(session.user.role, 'USER');
      assert.match(register.cookie, /HttpOnly/i);
      const token = session.accessToken;
      assert.equal((await call('/profile/me')).status, 401);
      assert.equal((await call('/profile/me', { method: 'PATCH', body: { displayName: 'No' } })).status, 401);
      assert.equal((await call('/users', { token })).status, 403);
      const mine = await call('/profile/me', { token });
      assert.equal(mine.status, 200);
      assert.equal(mine.data.data.id, session.user.id);
      assert.ok(!/password|token/i.test(JSON.stringify(mine.data)));
      const otherId = randomUUID(); ids.push(otherId);
      await getPool().query(`INSERT INTO users(id,email,display_name) VALUES($1,$2,'Other profile')`, [otherId, otherId + '@example.test']);
      for (const extra of [{ role: 'ADMIN' }, { userId: otherId }, { id: otherId }, { isActive: false }, { promoterId: randomUUID() }, { email: 'changed@example.test' }, { password: 'changed-secret' }]) {
        assert.equal((await call('/profile/me', { method: 'PATCH', token, body: { displayName: 'Escalation', ...extra } })).status, 400);
      }
      assert.equal((await call(`/profile/${otherId}`, { method: 'PATCH', token, body: { displayName: 'No' } })).status, 404);
      assert.equal((await call(`/users/${otherId}`, { method: 'PATCH', token, body: { displayName: 'No' } })).status, 403);
      assert.equal((await call('/profile/me', { method: 'PATCH', token, body: { displayName: '   ' } })).status, 400);
      assert.equal((await call('/profile/me', { method: 'PATCH', token, body: { displayName: '  Updated  ' } })).data.data.displayName, 'Updated');
      assert.equal((await call('/auth/me', { token })).data.data.displayName, 'Updated');
      assert.equal((await call('/auth/me', { method: 'PATCH', token, body: { displayName: 'Compatible' } })).status, 200);
      assert.equal((await call('/profile/me', { token })).data.data.displayName, 'Compatible');
      assert.equal((await getPool().query('SELECT display_name,role FROM users WHERE id=$1', [otherId])).rows[0].display_name, 'Other profile');
      assert.equal((await getPool().query('SELECT role FROM users WHERE id=$1', [session.user.id])).rows[0].role, 'USER');

      const expired = await new SignJWT({ role: 'USER' }).setProtectedHeader({ alg: 'HS256' })
        .setSubject(session.user.id).setIssuer('nocturno-api').setAudience('nocturno-web')
        .setIssuedAt(Math.floor(Date.now()/1000)-60).setExpirationTime(Math.floor(Date.now()/1000)-1)
        .sign(new TextEncoder().encode(env.JWT_ACCESS_SECRET));
      assert.equal((await call('/profile/me', { token: expired })).status, 401);
      const refreshed = await call('/auth/refresh', { method: 'POST', cookie: register.cookie.split(';')[0] });
      assert.equal(refreshed.status, 200);
      assert.equal((await call('/profile/me', { token: refreshed.data.data.accessToken })).status, 200);
      assert.equal(refreshed.data.data.user.displayName, 'Compatible');
      assert.equal((await call('/auth/logout', { method: 'POST', cookie: refreshed.cookie.split(';')[0] })).status, 204);
      assert.equal((await call('/auth/refresh', { method: 'POST', cookie: refreshed.cookie.split(';')[0] })).status, 401);
      assert.equal((await call('/auth/login', { method: 'POST', body: { email, password } })).status, 200);

      const admin = randomUUID(); ids.push(admin);
      await getPool().query(`INSERT INTO users(id,email,display_name,role) VALUES($1,$2,'Profile admin','ADMIN')`, [admin, admin + '@example.test']);
      const adminToken = await new SignJWT({ role: 'ADMIN' }).setProtectedHeader({ alg: 'HS256' })
        .setSubject(admin).setIssuer('nocturno-api').setAudience('nocturno-web').setIssuedAt().setExpirationTime('5m')
        .sign(new TextEncoder().encode(env.JWT_ACCESS_SECRET));
      assert.equal((await call('/users?limit=1', { token: adminToken })).status, 200);
      assert.equal((await call(`/users/${otherId}`, { method: 'PATCH', token: adminToken, body: { isActive: false } })).status, 200);
    } finally {
      await getPool().query('DELETE FROM users WHERE id=ANY($1::uuid[])', [ids]);
      await new Promise(resolve => server.close(resolve));
      await closePool();
    }
  });
