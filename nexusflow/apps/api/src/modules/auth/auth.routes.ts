import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';
import type { Mailer } from '../../infra/mailer';
import { authenticate, requireTrustedOrigin } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { createAuthController } from './auth.controller';
import { createAuthService } from './auth.service';
import {
  forgotPasswordBody, loginBody, registerBody, resetPasswordBody, verifyEmailBody,
} from './auth.validators';

// Brute-force / abuse protection: 20 attempts per IP per 15 minutes on sensitive endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === 'test' ? 10_000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts, try again later' } },
});

export function createAuthRouter(mailer: Mailer): Router {
  const c = createAuthController(createAuthService(mailer));
  const r = Router();

  r.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  r.post('/register', authLimiter, validate({ body: registerBody }), c.register);
  r.post('/login', authLimiter, validate({ body: loginBody }), c.login);
  r.post('/refresh', requireTrustedOrigin, c.refresh);
  r.post('/logout', requireTrustedOrigin, c.logout);
  r.post('/logout-all', authenticate, c.logoutAll);
  r.post('/verify-email', authLimiter, validate({ body: verifyEmailBody }), c.verifyEmail);
  r.post('/forgot-password', authLimiter, validate({ body: forgotPasswordBody }), c.forgotPassword);
  r.post('/reset-password', authLimiter, validate({ body: resetPasswordBody }), c.resetPassword);
  r.get('/me', authenticate, c.me);

  return r;
}
