import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './config/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestId } from './middleware/requestId';
import { createHealthRouter, type ReadinessCheck } from './modules/health/health.routes';

export interface AppDeps {
  readinessChecks: ReadinessCheck[];
}

export function createApp({ readinessChecks }: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as Request).requestId,
      autoLogging: { ignore: (req) => req.url?.startsWith('/health') ?? false },
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: [env.CLIENT_URL], credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  const health = createHealthRouter(readinessChecks);
  app.use('/health', health);
  app.use('/api/v1/health', health);

  // Coarse global limiter; stricter per-route limiters (login, reset) arrive with the auth module.
  app.use(
    '/api',
    rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false }),
  );

  // Module routers are mounted here under /api/v1 as they are built.

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
