import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { getPool, closePool } from '../src/config/db.js';

test('browser HttpOnly sessions, scoped CSRF and logout never expose credentials in JSON',
  { skip: !env.DATABASE_URL }, async () => {
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const email = `cookie-only-${randomUUID()}@example.test`;
    let userId;
    async function request(path, { method = 'GET', body, cookies = [], csrf, originHeader, fetchSite } = {}) {
      const response = await fetch(origin + '/api' + path, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(cookies.length ? { cookie: cookies.join('; ') } : {}),
          ...(csrf ? { 'x-nocturno-csrf': csrf } : {}),
          ...(originHeader ? { origin: originHeader } : {}),
          ...(fetchSite ? { 'sec-fetch-site': fetchSite } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      const data = response.status === 204 ? null : await response.json();
      return { status: response.status, data, cookies: response.headers.getSetCookie() };
    }
    function namedCookie(result, name) {
      const value = result.cookies.find(entry => entry.startsWith(name + '='));
      assert.ok(value, `Expected ${name} cookie`);
      return value.split(';')[0];
    }
    try {
      const registered = await request('/auth/register', { method: 'POST',
        body: { email, displayName: 'Cookie security', password: 'CookieFixture!2026' } });
      assert.equal(registered.status, 201);
      userId = registered.data.data.user.id;
      assert.equal(Object.hasOwn(registered.data.data, 'accessToken'), false);
      assert.equal(Object.hasOwn(registered.data.data, 'refreshToken'), false);
      assert.ok(registered.data.data.csrfToken);
      const access = namedCookie(registered, 'nocturno_access');
      const refresh = namedCookie(registered, 'nocturno_refresh');
      assert.match(registered.cookies.find(c => c.startsWith('nocturno_access=')), /HttpOnly/i);
      assert.match(registered.cookies.find(c => c.startsWith('nocturno_access=')), /SameSite=Lax/i);
      assert.match(registered.cookies.find(c => c.startsWith('nocturno_access=')), /Path=\/api/i);
      const browser = [access, refresh];
      const session = await request('/auth/session', { cookies: browser });
      assert.equal(session.status, 200);
      assert.equal(session.data.data.user.id, userId);
      assert.equal(Object.hasOwn(session.data.data, 'accessToken'), false);
      assert.equal(session.data.data.csrfToken, registered.data.data.csrfToken);

      const missing = await request('/profile/me', { method: 'PATCH', cookies: browser,
        body: { displayName: 'Blocked' } });
      assert.equal(missing.status, 403);
      assert.equal(missing.data.error.code, 'INVALID_CSRF');
      assert.equal((await request('/profile/me', { method: 'PATCH', cookies: browser,
        csrf: 'x'.repeat(43), body: { displayName: 'Blocked' } })).status, 403);
      assert.equal((await request('/profile/me', { method: 'PATCH', cookies: browser,
        csrf: session.data.data.csrfToken, originHeader: 'https://evil.example',
        body: { displayName: 'Blocked' } })).status, 403);
      assert.equal((await request('/profile/me', { method: 'PATCH', cookies: browser,
        csrf: session.data.data.csrfToken, fetchSite: 'cross-site',
        body: { displayName: 'Blocked' } })).status, 403);
      const updated = await request('/profile/me', { method: 'PATCH', cookies: browser,
        csrf: session.data.data.csrfToken, body: { displayName: 'Updated securely' } });
      assert.equal(updated.status, 200, JSON.stringify(updated.data));
      assert.equal(updated.data.data.displayName, 'Updated securely');

      const refreshed = await request('/auth/refresh', { method: 'POST', cookies: [refresh] });
      assert.equal(refreshed.status, 200);
      assert.equal(Object.hasOwn(refreshed.data.data, 'accessToken'), false);
      assert.equal(refreshed.data.data.csrfToken, registered.data.data.csrfToken);
      const newAccess = namedCookie(refreshed, 'nocturno_access');
      const newRefresh = namedCookie(refreshed, 'nocturno_refresh');
      assert.notEqual(refresh, newRefresh);
      const loggedOut = await request('/auth/logout', { method: 'POST',
        cookies: [newAccess, newRefresh] });
      assert.equal(loggedOut.status, 204);
      assert.equal((await request('/auth/session', { cookies: [newAccess] })).status, 401);
      assert.equal((await request('/auth/refresh', { method: 'POST', cookies: [newRefresh] })).status, 401);
      assert.equal((await request('/auth/session', { cookies: [access] })).status, 401);
    } finally {
      if (userId) await getPool().query('DELETE FROM users WHERE id = $1', [userId]);
      await new Promise(resolve => server.close(resolve));
      await closePool();
    }
  });
