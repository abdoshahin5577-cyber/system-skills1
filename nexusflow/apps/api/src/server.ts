import http from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { checkMongo, connectMongo, disconnectMongo } from './infra/mongo';
import { checkRedis, createRedis } from './infra/redis';

async function main() {
  await connectMongo(env.MONGODB_URI);
  const redis = createRedis(env.REDIS_URL);
  redis.on('error', (err) => logger.error({ err }, 'Redis error'));

  const app = createApp({
    readinessChecks: [
      { name: 'mongo', check: checkMongo },
      { name: 'redis', check: () => checkRedis(redis) },
    ],
  });

  const server = http.createServer(app);
  server.listen(env.PORT, () => logger.info(`API listening on :${env.PORT} (${env.NODE_ENV})`));

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down');
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    server.close();
    await Promise.allSettled([disconnectMongo(), redis.quit()]);
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'Unhandled rejection'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
});
