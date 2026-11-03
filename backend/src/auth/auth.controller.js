import { env } from '../config/env.js';
import { authService, refreshCookieMaxAge } from './auth.service.js';
import { accessCookieName, refreshCookieName, accessCookieOptions, refreshCookieOptions,
  readAccessCookie, readRefreshCookie } from './auth.cookies.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function accessMaxAge() {
  const match = /^(\d+)([smhd])$/.exec(env.JWT_ACCESS_EXPIRES_IN);
  if (!match) throw new Error('Invalid JWT_ACCESS_EXPIRES_IN for cookie session');
  return Number(match[1]) * { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]];
}

function sendSession(res, session, status = 200) {
  res.set('Cache-Control', 'no-store');
  res.cookie(refreshCookieName, session.refreshToken, { ...refreshCookieOptions, maxAge: refreshCookieMaxAge });
  res.cookie(accessCookieName, session.accessToken, { ...accessCookieOptions, maxAge: accessMaxAge() });
  // Never expose JWTs or refresh credentials to the Angular JavaScript runtime.
  return res.status(status).json({ data: { user: session.user, csrfToken: session.csrfToken } });
}

export const authController = {
  register: asyncHandler(async (req, res) =>
    sendSession(res, await authService.register(req.validated.body), 201)),
  login: asyncHandler(async (req, res) =>
    sendSession(res, await authService.login(req.validated.body))),
  session: asyncHandler(async (req, res) => {
    const data = await authService.sessionFromAccess(readAccessCookie(req));
    res.set('Cache-Control', 'no-store').json({ data });
  }),
  refresh: asyncHandler(async (req, res) =>
    sendSession(res, await authService.refresh(readRefreshCookie(req)))),
  logout: asyncHandler(async (req, res) => {
    const header = req.get('authorization');
    await authService.logout(readRefreshCookie(req),
      readAccessCookie(req) ?? (header?.startsWith('Bearer ') ? header.slice(7) : null));
    res.set('Cache-Control', 'no-store');
    res.clearCookie(refreshCookieName, refreshCookieOptions);
    res.clearCookie(accessCookieName, accessCookieOptions);
    res.status(204).end();
  })
};
