import crypto from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { Errors } from '../../shared/errors';

const ISSUER = 'nexusflow';
const AUDIENCE = 'nexusflow-api';

/** Opaque random token (refresh / email / reset). Only its keyed hash is ever stored. */
export const randomToken = (bytes = 48): string => crypto.randomBytes(bytes).toString('base64url');

/** HMAC-SHA256 keyed with JWT_REFRESH_SECRET: a leaked DB alone cannot be used to forge lookups. */
export const hashToken = (value: string): string =>
  crypto.createHmac('sha256', env.JWT_REFRESH_SECRET).update(value).digest('hex');

export function signAccessToken(userId: string): string {
  return jwt.sign({}, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    subject: userId,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
  });
}

export function verifyAccessToken(token: string): { userId: string } {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'], // pin the algorithm: blocks "alg: none" / algorithm confusion
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload === 'string' || !payload.sub) throw new Error('bad payload');
    return { userId: payload.sub };
  } catch {
    throw Errors.unauthorized('Invalid or expired access token');
  }
}
