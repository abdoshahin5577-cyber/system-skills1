import * as argon2 from 'argon2';
import { env } from '../../config/env';

const options: argon2.Options =
  env.NODE_ENV === 'test'
    ? { type: argon2.argon2id, memoryCost: 1024, timeCost: 2, parallelism: 1 } // fast, tests only
    : { type: argon2.argon2id };

export const hashPassword = (plain: string): Promise<string> => argon2.hash(plain, options);

export const verifyPassword = async (hash: string, plain: string): Promise<boolean> => {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
};

let dummy: Promise<string> | undefined;
/** Verified against when the email is unknown, so response time does not reveal which emails exist. */
export const dummyHash = (): Promise<string> => (dummy ??= hashPassword('nexusflow-dummy-password'));
