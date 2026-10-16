import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { env, requireAuthSecrets } from '../config/env.js';
import { authRepository } from '../repositories/auth.repository.js';
import { toCamel } from '../utils/mapping.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { AppError } from '../utils/AppError.js';

const issuer = 'nocturno-api';
const audience = 'nocturno-web';
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

async function accessTokenFor(user) {
  const secret = new TextEncoder().encode(requireAuthSecrets().access);
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_EXPIRES_IN)
    .sign(secret);
}

async function createSession(user) {
  const refreshToken = randomBytes(48).toString('base64url');
  await authRepository.storeRefreshToken({
    userId: user.id,
    tokenHash: refreshHash(refreshToken),
    familyId: randomUUID(),
    expiresAt: refreshExpiry()
  });
  return { user, accessToken: await accessTokenFor(user), refreshToken };
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
    if (!oldToken) throw new AppError(401, 'UNAUTHENTICATED', 'Sign in required');
    const newToken = randomBytes(48).toString('base64url');
    const row = await authRepository.rotateRefreshToken(
      refreshHash(oldToken), refreshHash(newToken), refreshExpiry());
    if (!row) throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Session expired');
    const user = publicUser(row);
    return { user, accessToken: await accessTokenFor(user), refreshToken: newToken };
  },
  async logout(token) {
    if (token) await authRepository.revokeRefreshFamily(refreshHash(token));
  },
  async verifyAccess(token) {
    if (!token) throw new AppError(401, 'UNAUTHENTICATED', 'Sign in required');
    let subject;
    try {
      const { payload } = await jwtVerify(
        token, new TextEncoder().encode(requireAuthSecrets().access),
        { issuer, audience, algorithms: ['HS256'] });
      subject = payload.sub;
    } catch {
      throw new AppError(401, 'INVALID_ACCESS_TOKEN', 'Sign in again');
    }
    const row = await authRepository.findById(subject);
    if (!row?.is_active) throw new AppError(401, 'UNAUTHENTICATED', 'Sign in required');
    return publicUser(row);
  },
  async updateProfile(userId, displayName) {
    return publicUser(await authRepository.updateProfile(userId, displayName));
  }
};

export const refreshCookieMaxAge = refreshDays * 24 * 60 * 60 * 1000;
