import { Router } from 'express';
import { asyncHandler } from '../../shared/asyncHandler';

export interface ReadinessCheck {
  name: string;
  check: () => Promise<void>;
}

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

export function createHealthRouter(checks: ReadinessCheck[]): Router {
  const router = Router();

  // Liveness: process is up. Never touches dependencies.
  router.get('/live', (_req, res) => {
    res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
  });

  // Readiness: dependencies reachable. 503 tells orchestrators to stop routing traffic.
  router.get(
    '/ready',
    asyncHandler(async (_req, res) => {
      const results = await Promise.all(
        checks.map(async ({ name, check }) => {
          try {
            await withTimeout(check(), 2000);
            return [name, 'up'] as const;
          } catch {
            return [name, 'down'] as const;
          }
        }),
      );
      const ok = results.every(([, s]) => s === 'up');
      res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'degraded', checks: Object.fromEntries(results) });
    }),
  );

  return router;
}
