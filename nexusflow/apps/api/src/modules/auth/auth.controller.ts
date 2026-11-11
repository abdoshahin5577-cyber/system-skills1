import type { Request, Response } from 'express';
import { env } from '../../config/env';
import { getAuth } from '../../middleware/authenticate';
import { asyncHandler } from '../../shared/asyncHandler';
import { Errors } from '../../shared/errors';
import { sendSuccess } from '../../shared/response';
import type { AuthService, Session } from './auth.service';

export const REFRESH_COOKIE = 'nf_refresh';

// Scoped to the auth routes only, so the browser never attaches it to other API calls.
const cookieBase = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth',
};

const meta = (req: Request) => ({ ip: req.ip, userAgent: req.get('user-agent') });
const readRefreshCookie = (req: Request): string | undefined => {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && value ? value : undefined;
};
const setRefreshCookie = (res: Response, s: Session) =>
  res.cookie(REFRESH_COOKIE, s.refreshToken, { ...cookieBase, expires: s.refreshExpiresAt });

export function createAuthController(service: AuthService) {
  return {
    register: asyncHandler(async (req, res) => {
      sendSuccess(res, { user: await service.register(req.body) }, { status: 201 });
    }),

    login: asyncHandler(async (req, res) => {
      const { user, session } = await service.login(req.body, meta(req));
      setRefreshCookie(res, session);
      sendSuccess(res, { user, accessToken: session.accessToken, expiresIn: env.ACCESS_TOKEN_TTL_SECONDS });
    }),

    refresh: asyncHandler(async (req, res) => {
      const raw = readRefreshCookie(req);
      if (!raw) throw Errors.unauthorized('Missing refresh token');
      try {
        const session = await service.refresh(raw, meta(req));
        setRefreshCookie(res, session);
        sendSuccess(res, { accessToken: session.accessToken, expiresIn: env.ACCESS_TOKEN_TTL_SECONDS });
      } catch (err) {
        res.clearCookie(REFRESH_COOKIE, cookieBase);
        throw err;
      }
    }),

    logout: asyncHandler(async (req, res) => {
      await service.logout(readRefreshCookie(req));
      res.clearCookie(REFRESH_COOKIE, cookieBase);
      sendSuccess(res, { loggedOut: true });
    }),

    logoutAll: asyncHandler(async (req, res) => {
      await service.logoutAll(getAuth(req).userId);
      res.clearCookie(REFRESH_COOKIE, cookieBase);
      sendSuccess(res, { loggedOut: true });
    }),

    me: asyncHandler(async (req, res) => {
      sendSuccess(res, { user: await service.getMe(getAuth(req).userId) });
    }),

    verifyEmail: asyncHandler(async (req, res) => {
      await service.verifyEmail(req.body.token);
      sendSuccess(res, { verified: true });
    }),

    forgotPassword: asyncHandler(async (req, res) => {
      await service.forgotPassword(req.body.email);
      sendSuccess(res, { message: 'If that email exists, a reset link has been sent.' }, { status: 202 });
    }),

    resetPassword: asyncHandler(async (req, res) => {
      await service.resetPassword(req.body.token, req.body.password);
      sendSuccess(res, { reset: true });
    }),
  };
}
