import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { env, requireAuthSecrets } from '../config/env.js';
import { authRepository } from './auth.repository.js';
import { toCamel } from '../utils/mapping.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { AppError } from '../utils/AppError.js';

const issuer = 'nocturno-api';
const audience = 'nocturno-web';
const isRefreshToken = value => typeof value === 'string' && /^[A-Za-z0-9_-]{64}$/.test(value);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validClaims(payload) {
  return payload && [payload.sub, payload.sid, payload.jti].every(value => typeof value === 'string' && uuid.test(value))
    && ['USER', 'PROMOTER', 'ADMIN'].includes(payload.role)
    && Number.isInteger(payload.iat) && Number.isInteger(payload.exp);
}
const refreshDays = Number.parseInt(env.JWT_REFRESH_EXPIRES_IN, 10);

function publicUser(row) {
  const { password_hash: _passwordHash, ...safe } = row;
  return toCamel(safe);
}

function refreshHash(token) {
  return createHmac('sha256', requireAuthSecrets().refresh).update(token).digest('hex');
}

function refreshExpiry() {
  return new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000);
}

async function accessTokenFor(user, familyId) {
  const secret = new TextEncoder().encode(requireAuthSecrets().access);
  return new SignJWT({ role: user.role, sid: familyId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setJti(randomUUID())
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_EXPIRES_IN)
    .sign(secret);
}

async function createSession(user) {
  const refreshToken = randomBytes(48).toString('base64url');
  const familyId = randomUUID();
  await authRepository.storeRefreshToken({
    userId: user.id, role: user.role,
    tokenHash: refreshHash(refreshToken),
    familyId,
    expiresAt: refreshExpiry()
  });
  return { user, accessToken: await accessTokenFor(user, familyId), refreshToken };
}

export const authService = {
  async register(input) {
    const user = publicUser(await authRepository.createUser({
      email: input.email,
      displayName: input.displayName,
      passwordHash: await hashPassword(input.password)
    }));
    return createSession(user);
  },
  async login({ email, password }) {
    const row = await authRepository.findByEmail(email);
    if (!row?.is_active || !(await verifyPassword(password, row.password_hash)))
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
    return createSession(publicUser(row));
  },
  async refresh(oldToken) {
    if (!isRefreshToken(oldToken)) throw new AppError(401, 'UNAUTHENTICATED', 'Sign in required');
    const newToken = randomBytes(48).toString('base64url');
    const row = await authRepository.rotateRefreshToken(
      refreshHash(oldToken), refreshHash(newToken), refreshExpiry());
    if (!row) throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Session expired');
    const { session_family_id: familyId, ...userRow } = row;
    const user = publicUser(userRow);
    return { user, accessToken: await accessTokenFor(user, familyId), refreshToken: newToken };
  },
  async logout(refreshToken, accessToken) {
    // Verify cryptography before using claims; expired/invalid cookies still get cleared.
    let payload;
    if (typeof accessToken === 'string') {
      try { ({ payload } = await jwtVerify(accessToken,
        new TextEncoder().encode(requireAuthSecrets().access),
        { issuer, audience, algorithms: ['HS256'] })); }
      catch (error) {
        if (!String(error?.code).startsWith('ERR_J')) throw error;
      }
    }
    await authRepository.revokeSession(isRefreshToken(refreshToken) ? refreshHash(refreshToken) : null,
      validClaims(payload) ? payload : null);
  },
  async verifyAccess(token) {
    if (typeof token !== 'string' || token.length > 4096) throw new AppError(401, 'UNAUTHENTICATED', 'Sign in required');
    let payload;
    try {
      ({ payload } = await jwtVerify(token, new TextEncoder().encode(requireAuthSecrets().access),
        { issuer, audience, algorithms: ['HS256'] }));
    } catch { throw new AppError(401, 'INVALID_ACCESS_TOKEN', 'Sign in again'); }
    if (!validClaims(payload)) throw new AppError(401, 'INVALID_ACCESS_TOKEN', 'Sign in again');
    const row = await authRepository.findAuthenticatedUser(payload);
    if (!row) throw new AppError(401, 'UNAUTHENTICATED', 'Sign in required');
    return publicUser(row);
  }
};

export const refreshCookieMaxAge = refreshDays * 24 * 60 * 60 * 1000;
