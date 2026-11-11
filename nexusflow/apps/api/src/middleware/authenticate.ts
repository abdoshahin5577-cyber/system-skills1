import type { RequestHandler, Request } from 'express';
import { env } from '../config/env';
import { Errors } from '../shared/errors';
import { verifyAccessToken } from '../modules/auth/token.utils';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { userId: string };
    }
  }
}

/** Access token travels in the Authorization header (kept in memory by the SPA), never in a cookie. */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.header('authorization');
  if (!header || !header.startsWith('Bearer ')) return next(Errors.unauthorized());
  try {
    req.auth = verifyAccessToken(header.slice(7).trim());
    next();
  } catch (err) {
    next(err);
  }
};

export function getAuth(req: Request): { userId: string } {
  if (!req.auth) throw Errors.unauthorized();
  return req.auth;
}

/**
 * CSRF defence for the cookie-authenticated endpoints (refresh/logout), on top of SameSite=Strict:
 * a browser-sent Origin that is not our client is rejected.
 */
export const requireTrustedOrigin: RequestHandler = (req, _res, next) => {
  const origin = req.get('origin');
  if (origin && origin.replace(/\/$/, '') !== env.CLIENT_URL.replace(/\/$/, '')) {
    return next(Errors.forbidden('Untrusted origin'));
  }
  next();
};
