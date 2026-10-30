import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { getPool, closePool } from '../src/config/db.js';
import { hashPassword } from '../src/utils/password.js';

// A real DB-backed integration test, using only isolated UUID users.
test('Users administration protects role lifecycle and revokes both token types immediately', {
  skip: !env.DATABASE_URL
}, async () => {
  const pool = getPool();
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const adminId = randomUUID();
  const adminEmail = `users-admin-${adminId}@example.test`;
  const adminPassword = 'AdminFixture!2026';
  const memberEmail = `users-member-${randomUUID()}@example.test`;
  const memberPassword = 'MemberFixture!2026';
  let memberId = null;

  async function call(path, { method = 'GET', token, cookie, body } = {}) {
    const response = await fetch(origin + '/api' + path, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: 'Bearer ' + token } : {}),
        ...(cookie ? { cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const setCookie = response.headers.get('set-cookie')?.split(';')[0] ?? null;
    return { status: response.status, data: response.status === 204 ? null : await response.json(), cookie: setCookie };
  }

  try {
    await pool.query(
      `INSERT INTO users(id,email,display_name,password_hash,role)
       VALUES($1,$2,'Fixture admin',$3,'ADMIN')`,
      [adminId, adminEmail, await hashPassword(adminPassword)]
    );
    const adminLogin = await call('/auth/login', { method: 'POST',
      body: { email: adminEmail, password: adminPassword } });
    assert.equal(adminLogin.status, 200);
    const adminToken = adminLogin.data.data.accessToken;
    assert.ok(adminToken);

    const created = await call('/users', { method: 'POST', token: adminToken,
      body: { email: memberEmail, displayName: 'Fixture user', password: memberPassword, role: 'USER' } });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    memberId = created.data.data.id;
    assert.equal(created.data.data.role, 'USER');
    assert.ok(!JSON.stringify(created.data).includes('passwordHash'));
    assert.equal((await call('/users', { method: 'GET', token: adminToken })).status, 200);

    const firstLogin = await call('/auth/login', { method: 'POST',
      body: { email: memberEmail, password: memberPassword } });
    assert.equal(firstLogin.status, 200);
    const firstToken = firstLogin.data.data.accessToken;
    const firstCookie = firstLogin.cookie;
    assert.equal((await call('/users', { token: firstToken })).status, 403);
    assert.equal((await call('/users', { method: 'POST', token: firstToken,
      body: { email: 'forbidden@example.test', displayName: 'No', password: memberPassword } })).status, 403);

    const elevated = await call(`/users/${memberId}`, { method: 'PATCH', token: adminToken, body: { role: 'ADMIN' } });
    assert.equal(elevated.status, 200, JSON.stringify(elevated.data));
    assert.equal(elevated.data.data.role, 'ADMIN');
    assert.equal((await call('/users', { token: firstToken })).status, 401);
    assert.equal((await call('/auth/refresh', { method: 'POST', cookie: firstCookie })).status, 401);

    const elevatedLogin = await call('/auth/login', { method: 'POST',
      body: { email: memberEmail, password: memberPassword } });
    assert.equal(elevatedLogin.status, 200);
    assert.equal(elevatedLogin.data.data.user.role, 'ADMIN');
    assert.equal((await call('/users', { token: elevatedLogin.data.data.accessToken })).status, 200);

    assert.equal((await call(`/users/${adminId}`, { method: 'PATCH', token: adminToken,
      body: { isActive: false } })).status, 409);
    assert.equal((await call(`/users/${adminId}`, { method: 'PATCH', token: adminToken,
      body: { role: 'USER' } })).status, 409);
    assert.equal((await call(`/users/${adminId}`, { method: 'DELETE', token: adminToken })).status, 409);

    const downgraded = await call(`/users/${memberId}`, { method: 'PATCH', token: adminToken,
      body: { role: 'USER' } });
    assert.equal(downgraded.status, 200, JSON.stringify(downgraded.data));
    assert.equal((await call('/users', { token: elevatedLogin.data.data.accessToken })).status, 401);
    assert.equal((await call('/auth/refresh', { method: 'POST', cookie: elevatedLogin.cookie })).status, 401);

    const memberLogin = await call('/auth/login', { method: 'POST',
      body: { email: memberEmail, password: memberPassword } });
    assert.equal(memberLogin.status, 200);
    assert.equal((await call(`/users/${memberId}`, { method: 'PATCH', token: adminToken,
      body: { isActive: false } })).status, 200);
    assert.equal((await call('/profile/me', { token: memberLogin.data.data.accessToken })).status, 401);
    assert.equal((await call('/auth/refresh', { method: 'POST', cookie: memberLogin.cookie })).status, 401);
    assert.equal((await call('/auth/login', { method: 'POST',
      body: { email: memberEmail, password: memberPassword } })).status, 401);

    assert.equal((await call(`/users/${memberId}`, { method: 'PATCH', token: adminToken,
      body: { isActive: true } })).status, 200);
    assert.equal((await call('/auth/refresh', { method: 'POST', cookie: memberLogin.cookie })).status, 401);
    const restoredLogin = await call('/auth/login', { method: 'POST',
      body: { email: memberEmail, password: memberPassword } });
    assert.equal(restoredLogin.status, 200);
    // Even if the refresh cookie is unavailable, a bearer-authenticated logout revokes its family.
    assert.equal((await call('/auth/logout', { method: 'POST',
      token: restoredLogin.data.data.accessToken })).status, 204);
    assert.equal((await call('/profile/me', { token: restoredLogin.data.data.accessToken })).status, 401);
    assert.equal((await call('/auth/refresh', { method: 'POST', cookie: restoredLogin.cookie })).status, 401);

    assert.equal((await call(`/users/${memberId}`, { method: 'DELETE', token: adminToken })).status, 204);
    memberId = null;
    assert.equal((await call('/auth/login', { method: 'POST',
      body: { email: memberEmail, password: memberPassword } })).status, 401);
    assert.equal((await call('/users', { token: adminToken })).status, 200);
  } finally {
    // Tests never reset databases; only remove their own isolated fixtures.
    if (memberId) await pool.query('DELETE FROM users WHERE id=$1', [memberId]);
    await pool.query('DELETE FROM users WHERE id=$1', [adminId]);
    await new Promise(resolve => server.close(resolve));
    await closePool();
  }
});
