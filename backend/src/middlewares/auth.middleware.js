import { authService } from '../services/auth.service.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { frontendOrigins } from '../config/env.js';

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  req.user = await authService.verifyAccess(token);
  next();
});

export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const header = req.get('authorization');
  if (header?.startsWith('Bearer '))
    req.user = await authService.verifyAccess(header.slice(7));
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
