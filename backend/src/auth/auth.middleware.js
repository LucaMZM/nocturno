import { authService } from './auth.service.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { frontendOrigins } from '../config/env.js';

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.nocturno_access;
  req.user = await authService.verifyAccess(token);
  _res.set('Cache-Control', 'no-store');
  next();
});

export const optionalAuth = asyncHandler(async (req, _res, next) => {
  if (req.cookies?.nocturno_access)
    req.user = await authService.verifyAccess(req.cookies.nocturno_access);
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

export function protectCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  requireTrustedOrigin(req, res, (error) => {
    if (error) return next(error);
    if (req.get('sec-fetch-site') === 'cross-site' || req.get('x-nocturno-csrf') !== '1')
      return next(new AppError(403, 'CSRF_REJECTED', 'Request could not be verified'));
    next();
  });
}

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
