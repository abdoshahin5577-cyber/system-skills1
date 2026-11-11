import { Redis } from 'ioredis';

export function createRedis(url: string): Redis {
  return new Redis(url, { maxRetriesPerRequest: 2, enableReadyCheck: true });
}

export async function checkRedis(client: Redis): Promise<void> {
  const reply = await client.ping();
  if (reply !== 'PONG') throw new Error('Unexpected Redis reply');
}
