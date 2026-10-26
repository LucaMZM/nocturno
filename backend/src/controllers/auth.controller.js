import { env } from '../config/env.js';
import { authService, refreshCookieMaxAge } from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const cookieName = 'nocturno_refresh';
const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: refreshCookieMaxAge
};

function readRefreshCookie(req) {
  const cookie = req.get('cookie')?.split(';').map((value) => value.trim())
    .find((value) => value.startsWith(`${cookieName}=`));
  return cookie ? cookie.slice(cookieName.length + 1) : null;
}

function sendSession(res, session, status = 200) {
  res.cookie(cookieName, session.refreshToken, cookieOptions);
  res.status(status).json({ data: { user: session.user, accessToken: session.accessToken } });
}

export const authController = {
  register: asyncHandler(async (req, res) =>
    sendSession(res, await authService.register(req.validated.body), 201)),
  login: asyncHandler(async (req, res) =>
    sendSession(res, await authService.login(req.validated.body))),
  refresh: asyncHandler(async (req, res) =>
    sendSession(res, await authService.refresh(readRefreshCookie(req)))),
  logout: asyncHandler(async (req, res) => {
    await authService.logout(readRefreshCookie(req));
    res.clearCookie(cookieName, cookieOptions).status(204).end();
  })
};
