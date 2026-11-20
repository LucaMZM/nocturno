import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { decodeJwt, SignJWT } from 'jose';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { getPool, closePool } from '../src/config/db.js';
import { authService } from '../src/auth/auth.service.js';
import { accessCookieOptions, refreshCookieOptions } from '../src/auth/auth.controller.js';

test('cookie authentication, CSRF, persistent revocation and profile contracts', { skip: !env.DATABASE_URL }, async t => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`, pool = getPool();
  const ids = [], password = 'CookieFixture!2026', email = `cookies-${randomUUID()}@example.test`;
  const call = async (path, { method = 'GET', body, cookies = '', headers = {}, csrf = true } = {}) => {
    const response = await fetch(base + '/api' + path, { method, headers: {
      'content-type': 'application/json', ...(csrf ? { 'x-nocturno-csrf': '1' } : {}), cookie: cookies, ...headers,
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, headers: response.headers,
      cookies: response.headers.getSetCookie().map(value => value.split(';')[0]).join('; '),
      data: response.status === 204 ? null : await response.json() };
  };
  const login = () => call('/auth/login', { method: 'POST', body: { email, password } });
  const tokenOf = cookies => cookies.split('; ').find(value => value.startsWith('nocturno_access='))?.slice(16);
  try {
    let session;
    await t.test('register/login emit two scoped HttpOnly cookies and no JSON credentials', async () => {
      session = await call('/auth/register', { method: 'POST', body: { email, password, displayName: 'Cookie User' } });
      assert.equal(session.status, 201); ids.push(session.data.data.user.id);
      assert.deepEqual(Object.keys(session.data.data), ['user']);
      const cookies = session.headers.getSetCookie(); assert.equal(cookies.length, 2);
      for (const cookie of cookies) { assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/); }
      assert.match(cookies[0], /Path=\/api;/); assert.match(cookies[1], /Path=\/api\/auth;/);
      assert.equal(session.headers.get('cache-control'), 'no-store');
      const claims = decodeJwt(tokenOf(session.cookies));
      for (const key of ['sub', 'role', 'jti', 'sid', 'iat', 'exp', 'iss', 'aud']) assert.ok(claims[key]);
      assert.equal(claims.role, 'USER');
      assert.equal(accessCookieOptions.httpOnly, true); assert.equal(refreshCookieOptions.httpOnly, true);
      const bad = await call('/auth/login', { method: 'POST', body: { email, password: 'bad' } });
      assert.equal(bad.status, 401); assert.equal(bad.cookies, '');
    });
    await t.test('cookie-only private access, no cookies or Bearer rejected, USER cannot administer', async () => {
      assert.equal((await call('/profile/me', { cookies: session.cookies })).status, 200);
      assert.equal((await call('/profile/me')).status, 401);
      assert.equal((await call('/profile/me', { cookies: 'nocturno_access=j:%7B%22bad%22:true%7D' })).status, 401);
      assert.equal((await call('/auth/refresh', { method: 'POST', cookies: 'nocturno_refresh=j:%7B%22bad%22:true%7D' })).status, 401);
      assert.equal((await call('/auth/logout', { method: 'POST', cookies: 'nocturno_refresh=j:%7B%22bad%22:true%7D' })).status, 204);
      assert.equal((await call('/profile/me', { headers: { authorization: `Bearer ${tokenOf(session.cookies)}` } })).status, 401);
      assert.equal((await call('/users', { cookies: session.cookies })).status, 403);
    });
    await t.test('CSRF blocks form-like, foreign origin and cross-site mutations including login', async () => {
      for (const options of [{ csrf: false }, { headers: { origin: 'https://evil.test' } }, { headers: { 'sec-fetch-site': 'cross-site' } }]) {
        assert.equal((await call('/profile/me', { method: 'PATCH', cookies: session.cookies, body: { displayName: 'Bad' }, ...options })).status, 403);
        assert.equal((await call('/auth/login', { method: 'POST', body: { email, password }, ...options })).status, 403);
      }
      assert.equal((await call('/profile/me', { method: 'PATCH', cookies: session.cookies, headers: { origin: env.FRONTEND_URL }, body: { displayName: 'Allowed' } })).status, 200);
      assert.equal((await call('/stripe/webhook', { method: 'POST', csrf: false, body: {} })).data.error.code, 'INVALID_STRIPE_SIGNATURE');
    });
    await t.test('el perfil conserva nombre, oculta avatar histórico y bloquea asignación masiva', async () => {
      await pool.query("UPDATE users SET avatar_url='https://example.test/legacy.png' WHERE id=$1", [ids[0]]);
      const result = await call('/profile/me', { method: 'PATCH', cookies: session.cookies, body: { displayName: 'Updated' } });
      assert.equal(result.status, 200); assert.equal(result.data.data.avatarUrl, undefined);
      for (const avatarUrl of ['javascript:alert(1)', 'data:image/svg+xml,bad', 'http://example.test/x', 'https://user:pass@example.test/x'])
        assert.equal((await call('/profile/me', { method: 'PATCH', cookies: session.cookies, body: { avatarUrl } })).status, 400);
      assert.equal((await call('/profile/me', { method: 'PATCH', cookies: session.cookies, body: { role: 'ADMIN' } })).status, 400);
      session = await call('/auth/refresh', { method: 'POST', cookies: session.cookies });
      assert.equal(session.status, 200); assert.equal(session.data.data.user.avatarUrl, undefined);
      assert.equal((await call('/profile/me', { cookies: session.cookies })).data.data.displayName, 'Updated');
      assert.equal((await call('/profile/me', { method: 'PATCH', cookies: session.cookies, body: { avatarUrl: null } })).status, 400);
    });
    await t.test('signed but malformed, expired, tampered and obsolete-role JWTs rejected', async () => {
      const payload = decodeJwt(tokenOf(session.cookies));
      const sign = value => new SignJWT(value).setProtectedHeader({ alg: 'HS256' }).sign(new TextEncoder().encode(env.JWT_ACCESS_SECRET));
      for (const overrides of [{ sub: 'not-a-uuid' }, { sub: randomUUID() }, { jti: undefined }, { sid: 'bad' }, { role: 'ADMIN' }, { exp: 1 }, { iss: 'evil' }, { aud: 'evil' }]) {
        assert.equal((await call('/profile/me', { cookies: 'nocturno_access=' + await sign({ ...payload, ...overrides }) })).status, 401);
      }
      assert.equal((await call('/profile/me', { cookies: 'nocturno_access=' + tokenOf(session.cookies) + 'bad' })).status, 401);
      await pool.query("UPDATE users SET role='ADMIN' WHERE id=$1", [ids[0]]);
      assert.equal((await call('/profile/me', { cookies: session.cookies })).status, 401, 'DB role mismatch even without admin service revocation');
      await pool.query("UPDATE users SET role='USER',is_active=FALSE WHERE id=$1", [ids[0]]);
      assert.equal((await call('/profile/me', { cookies: session.cookies })).status, 401);
      assert.equal((await call('/auth/refresh', { method: 'POST', cookies: session.cookies })).status, 401);
      await pool.query('UPDATE users SET is_active=TRUE WHERE id=$1', [ids[0]]);
    });
    await t.test('blacklist independently rejects an unexpired token, logout revokes family and clears both cookies', async () => {
      const active = await login(), claims = decodeJwt(tokenOf(active.cookies));
      await pool.query(`INSERT INTO revoked_access_tokens(jti,user_id,expires_at) VALUES($1,$2,to_timestamp($3))`, [claims.jti, claims.sub, claims.exp]);
      assert.equal((await call('/profile/me', { cookies: active.cookies })).status, 401);
      const result = await call('/auth/logout', { method: 'POST', cookies: active.cookies });
      assert.equal(result.status, 204); assert.equal(result.headers.getSetCookie().length, 2);
      assert.ok(result.headers.getSetCookie().every(value => /Expires=Thu, 01 Jan 1970/.test(value)));
      assert.equal((await call('/auth/refresh', { method: 'POST', cookies: active.cookies })).status, 401);
      assert.equal((await pool.query('SELECT count(*)::int n FROM revoked_access_tokens WHERE jti=$1', [claims.jti])).rows[0].n, 1);
    });
    await t.test('database avatar/revocation constraints and administrative filters are independent of Angular', async () => {
      await assert.rejects(pool.query("UPDATE users SET avatar_url='javascript:bad' WHERE id=$1", [ids[0]]), { code: '23514' });
      await assert.rejects(pool.query('INSERT INTO revoked_access_tokens(jti,user_id,expires_at) VALUES($1,$2,NOW())', [randomUUID(),randomUUID()]), { code: '23503' });
      await pool.query("UPDATE users SET role='ADMIN' WHERE id=$1", [ids[0]]);
      const admin = await login();
      for (const [active, present] of [['all',true],['true',true],['false',false]]) {
        const result = await call('/users?search='+encodeURIComponent(email)+'&active='+active, { cookies: admin.cookies });
        assert.equal(result.status, 200); assert.equal(result.data.pagination.total, present ? 1 : 0);
        assert.equal(result.data.data.length, present ? 1 : 0);
      }
      assert.equal((await call('/users?active=unexpected', { cookies: admin.cookies })).status, 400);
      await pool.query("UPDATE users SET role='USER' WHERE id=$1", [ids[0]]);
      const malformed = await fetch(base+'/api/auth/login', { method:'POST', headers:{'content-type':'application/json','x-nocturno-csrf':'1'}, body:'{' });
      assert.equal(malformed.status,400); assert.equal((await malformed.json()).error.code,'INVALID_JSON');
    });
    await t.test('concurrent refresh/logout never leaves a live successor session', async () => {
      const active = await login();
      const [rotated, loggedOut] = await Promise.all([
        call('/auth/refresh', { method: 'POST', cookies: active.cookies }),
        call('/auth/logout', { method: 'POST', cookies: active.cookies })]);
      assert.equal(loggedOut.status, 204); assert.ok([200, 401].includes(rotated.status));
      assert.equal((await call('/profile/me', { cookies: active.cookies })).status, 401);
      if (rotated.status === 200) {
        assert.equal((await call('/profile/me', { cookies: rotated.cookies })).status, 401);
        assert.equal((await call('/auth/refresh', { method: 'POST', cookies: rotated.cookies })).status, 401);
      }
    });
    await t.test('concurrent refresh replay revokes entire family; cleanup removes only expired blacklist entries', async () => {
      const active = await login();
      const results = await Promise.all([1,2].map(() => call('/auth/refresh', { method: 'POST', cookies: active.cookies })));
      assert.deepEqual(results.map(r => r.status).sort(), [200,401]);
      assert.equal((await call('/profile/me', { cookies: results.find(r => r.status === 200).cookies })).status, 401);
      const expired = randomUUID();
      await pool.query(`INSERT INTO revoked_access_tokens(jti,user_id,expires_at) VALUES($1,$2,NOW()-interval '1 second')`, [expired,ids[0]]);
      await authService.logout(null, null);
      assert.equal((await pool.query('SELECT 1 FROM revoked_access_tokens WHERE jti=$1', [expired])).rowCount, 0);
      assert.ok((await pool.query('SELECT 1 FROM revoked_access_tokens WHERE user_id=$1', [ids[0]])).rowCount > 0);
    });
  } finally {
    await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [ids]);
    await new Promise(resolve => server.close(resolve)); await closePool();
  }
});

test('production cookie options enforce Secure and scoped HttpOnly paths', async () => {
  const { execFileSync } = await import('node:child_process');
  const options = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e',
    "import {accessCookieOptions,refreshCookieOptions} from './src/auth/auth.controller.js'; console.log(JSON.stringify([accessCookieOptions,refreshCookieOptions]));"],
  { cwd: new URL('..', import.meta.url), env: { ...process.env, NODE_ENV: 'production' }, encoding: 'utf8' }));
  assert.deepEqual(options.map(value => value.path), ['/api', '/api/auth']);
  assert.ok(options.every(value => value.secure && value.httpOnly && value.sameSite === 'lax' && !value.domain));
});
