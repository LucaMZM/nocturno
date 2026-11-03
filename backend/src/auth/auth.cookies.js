import { env } from '../config/env.js';

// The production access cookie uses __Host- (Secure, host-only, Path=/).
// Local HTTP development keeps a non-prefixed, API-scoped cookie.
export const accessCookieName = env.NODE_ENV === 'production'
  ? '__Host-nocturno_access' : 'nocturno_access';
export const refreshCookieName = env.NODE_ENV === 'production'
  ? '__Host-nocturno_refresh' : 'nocturno_refresh';
export const accessCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: env.NODE_ENV === 'production' ? '/' : '/api'
};
export const refreshCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: env.NODE_ENV === 'production' ? '/' : '/api/auth'
};
// The legacy unprefixed cookie is cleared, but never authenticated in production
// to prevent session fixation through less-restricted cookie scoping.
export const legacyRefreshCookieOptions = {
  httpOnly: true, secure: true, sameSite: 'lax', path: '/api/auth'
};
export function cookieValue(req, name) {
  const item = req.get('cookie')?.split(';').map(part => part.trim())
    .find(part => part.startsWith(name + '='));
  return item ? item.slice(name.length + 1) : null;
}
export const readAccessCookie = req => cookieValue(req, accessCookieName);
export const readRefreshCookie = req => cookieValue(req, refreshCookieName);
