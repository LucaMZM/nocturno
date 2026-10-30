import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { getPool, closePool } from '../src/config/db.js';

test('auth rotates refresh tokens and blocks cross-account writes', { skip: !env.DATABASE_URL }, async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const email = `auth-${randomUUID()}@example.com`;
  let userId;
  const call = async (path, { method = 'GET', body, cookie, token } = {}) => {
    const response = await fetch(origin + path, {
      method,
      headers: { 'content-type': 'application/json',
        ...(cookie ? { cookie } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return { status: response.status, body: response.status === 204 ? null : await response.json(),
      cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  try {
    const registered = await call('/api/auth/register', { method: 'POST',
      body: { email: email.toUpperCase(), displayName: 'Auth Test', password: 'test-password-123' } });
    assert.equal(registered.status, 201);
    userId = registered.body.data.user.id;
    assert.equal(registered.body.data.user.email, email);
    assert.ok(!JSON.stringify(registered.body).includes('passwordHash'));
    const firstToken = registered.body.data.accessToken;
    assert.equal((await call('/api/auth/me', { token: firstToken })).body.data.id, userId);
    assert.equal((await call('/api/events', { method: 'POST', token: firstToken, body: {} })).status, 403);
    assert.equal((await call(`/api/users/${userId}/favorites`, { token: firstToken })).status, 200);
    assert.equal((await call('/api/me/favorites', { token: firstToken })).status, 200);
    assert.equal((await call(`/api/users/${randomUUID()}/favorites`, { token: firstToken })).status, 403);
    const rotated = await call('/api/auth/refresh', { method: 'POST', cookie: registered.cookie });
    assert.equal(rotated.status, 200);
    assert.notEqual(rotated.cookie, registered.cookie);
    assert.equal((await call('/api/auth/refresh', { method: 'POST', cookie: registered.cookie })).status, 401);
    assert.equal((await call('/api/auth/refresh', { method: 'POST', cookie: rotated.cookie })).status, 401);
    assert.equal((await call('/api/auth/me', { token: firstToken })).status, 401);
    const login = await call('/api/auth/login', { method: 'POST', body: { email, password: 'test-password-123' } });
    assert.equal(login.status, 200);
    assert.equal((await call('/api/auth/logout', { method: 'POST', cookie: login.cookie })).status, 204);
    assert.equal((await call('/api/auth/me', { token: login.body.data.accessToken })).status, 401);
    assert.equal((await call('/api/auth/refresh', { method: 'POST', cookie: login.cookie })).status, 401);
  } finally {
    if (userId) await getPool().query('DELETE FROM users WHERE id = $1', [userId]);
    await new Promise((resolve) => server.close(resolve));
    await closePool();
  }
});
