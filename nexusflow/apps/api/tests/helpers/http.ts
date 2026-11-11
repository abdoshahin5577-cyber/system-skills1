import type { Express } from 'express';
import request from 'supertest';

export const PASSWORD = 'Passw0rd!xyz';
export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export function refreshCookieFrom(res: { headers: Record<string, unknown> }): string {
  const raw = ([] as string[]).concat((res.headers['set-cookie'] as string[] | string | undefined) ?? []);
  const cookie = raw.find((c) => c.startsWith('nf_refresh='));
  return cookie?.split(';')[0] ?? '';
}

export const tokenFrom = (text: string): string => /token=([A-Za-z0-9_-]+)/.exec(text)?.[1] ?? '';

export async function signup(app: Express, name: string) {
  const email = `${name}@example.com`;
  await request(app).post('/api/v1/auth/register').send({ email, name, password: PASSWORD }).expect(201);
  const res = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(200);
  return {
    email,
    password: PASSWORD,
    userId: res.body.data.user.id as string,
    token: res.body.data.accessToken as string,
    refreshCookie: refreshCookieFrom(res),
  };
}
