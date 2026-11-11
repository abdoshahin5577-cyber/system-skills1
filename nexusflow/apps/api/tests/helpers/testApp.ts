import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../../src/app';
import { ConsoleMailer } from '../../src/infra/mailer';
import '../../src/modules'; // registers every model so indexes can be built

let replSet: MongoMemoryReplSet | undefined;

/** In-memory single-node REPLICA SET: needed because workspace creation uses a transaction. */
export async function startTestDb(): Promise<void> {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri(), { dbName: 'nexusflow_test' });
  await Promise.all(Object.values(mongoose.models).map((m) => m.init())); // unique indexes must exist
}

export async function stopTestDb(): Promise<void> {
  await mongoose.disconnect();
  await replSet?.stop();
}

export async function clearDb(): Promise<void> {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

export function buildTestApp() {
  const mailer = new ConsoleMailer();
  const app = createApp({ readinessChecks: [], mailer });
  return { app, mailer };
}
