import { decodeJwt } from 'jose';
import { env } from '../config/env.js';
import { authService, refreshCookieMaxAge } from './auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const accessCookieOptions = { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/api' };
export const refreshCookieOptions = { ...accessCookieOptions, path: '/api/auth' };

function sendSession(res, session, status = 200) {
  res.set('Cache-Control', 'no-store');
  res.cookie('nocturno_access', session.accessToken, { ...accessCookieOptions,
    maxAge: Math.max(0, decodeJwt(session.accessToken).exp * 1000 - Date.now()) });
  res.cookie('nocturno_refresh', session.refreshToken, { ...refreshCookieOptions, maxAge: refreshCookieMaxAge });
  res.status(status).json({ data: { user: session.user } });
}

export const authController = {
  register: asyncHandler(async (req, res) => sendSession(res, await authService.register(req.validated.body), 201)),
  login: asyncHandler(async (req, res) => sendSession(res, await authService.login(req.validated.body))),
  refresh: asyncHandler(async (req, res) => sendSession(res, await authService.refresh(req.cookies.nocturno_refresh))),
  logout: asyncHandler(async (req, res) => {
    await authService.logout(req.cookies.nocturno_refresh, req.cookies.nocturno_access);
    res.set('Cache-Control', 'no-store');
    res.clearCookie('nocturno_access', accessCookieOptions);
    res.clearCookie('nocturno_refresh', refreshCookieOptions).status(204).end();
  })
};
