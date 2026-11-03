import { authService, validCsrfToken } from './auth.service.js';
import { readAccessCookie } from './auth.cookies.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { env, frontendOrigins } from '../config/env.js';

function credentials(req) {
  const cookie = readAccessCookie(req);
  const header = req.get('authorization');
  // Cookie authentication takes precedence: an Authorization header must
  // not bypass CSRF checks when a browser sends a session cookie.
  if (cookie) return cookie;
  // Legacy bearer fallback is exclusively for local tools and integration tests.
  // The production web API authenticates browser requests with HttpOnly cookies.
  if (env.NODE_ENV === 'production') return null;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

export const requireAuth = asyncHandler(async (req, _res, next) => {
  req.user = await authService.verifyAccess(credentials(req));
  next();
});
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = credentials(req);
  if (token) req.user = await authService.verifyAccess(token);
  next();
});
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new AppError(401, 'UNAUTHENTICATED', 'Sign in required'));
    if (!roles.includes(req.user.role))
      return next(new AppError(403, 'FORBIDDEN', 'You do not have permission'));
    next();
  };
}
export function requireTrustedOrigin(req, _res, next) {
  const origin = req.get('origin');
  if (origin && !frontendOrigins().includes(origin))
    return next(new AppError(403, 'FORBIDDEN_ORIGIN', 'Origin is not allowed'));
  next();
}

// Apply to all unsafe API methods, except the separately signed Stripe webhook.
// Login/refresh/logout are origin-checked and SameSite protected; authenticated
// mutations additionally require a per-session synchronizer header.
export const protectApiMutation = asyncHandler(async (req, _res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ||
      !req.path.startsWith('/api/')) return next();
  const origin = req.get('origin');
  if (origin && !frontendOrigins().includes(origin))
    throw new AppError(403, 'FORBIDDEN_ORIGIN', 'Origin is not allowed');
  if (req.get('sec-fetch-site') === 'cross-site')
    throw new AppError(403, 'FORBIDDEN_SITE', 'Cross-site mutation is not allowed');
  if (/^\/api\/auth\/(?:login|register|refresh|logout)$/.test(req.path))
    return next();
  const cookie = readAccessCookie(req);
  if (cookie) {
    const { familyId } = await authService.inspectAccess(cookie);
    if (!validCsrfToken(familyId, req.get('x-nocturno-csrf')))
      throw new AppError(403, 'INVALID_CSRF', 'Missing or invalid CSRF token');
  }
  next();
});

const attempts = new Map();
export function authRateLimit(req, _res, next) {
  const key = req.ip;
  const now = Date.now();
  const current = attempts.get(key);
  const entry = current && current.resetAt > now
    ? { count: current.count + 1, resetAt: current.resetAt }
    : { count: 1, resetAt: now + 15 * 60 * 1000 };
  attempts.set(key, entry);
  if (attempts.size > 10000) attempts.delete(attempts.keys().next().value);
  if (entry.count > 30) return next(new AppError(429, 'RATE_LIMITED', 'Try again later'));
  next();
}
