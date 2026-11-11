import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, clearDb, startTestDb, stopTestDb } from './helpers/testApp';
import { PASSWORD, bearer, refreshCookieFrom, signup, tokenFrom } from './helpers/http';

const { app, mailer } = buildTestApp();
const api = '/api/v1/auth';

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearDb();
  mailer.outbox.length = 0;
});

describe('registration', () => {
  it('registers a user and never leaks secrets', async () => {
    const res = await request(app).post(`${api}/register`).send({ email: 'Ann@Example.com', name: 'Ann', password: PASSWORD });
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ email: 'ann@example.com', emailVerified: false });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|Passw0rd/);
  });

  it('rejects weak passwords and unknown fields', async () => {
    const weak = await request(app).post(`${api}/register`).send({ email: 'a@example.com', name: 'A', password: 'short1' });
    expect(weak.status).toBe(422);
    const noDigit = await request(app).post(`${api}/register`).send({ email: 'a@example.com', name: 'A', password: 'abcdefghijkl' });
    expect(noDigit.status).toBe(422);
    const extra = await request(app).post(`${api}/register`).send({ email: 'a@example.com', name: 'A', password: PASSWORD, role: 'ADMIN' });
    expect(extra.status).toBe(422);
  });

  it('rejects duplicate emails with 409', async () => {
    await signup(app, 'ann');
    const res = await request(app).post(`${api}/register`).send({ email: 'ann@example.com', name: 'Ann', password: PASSWORD });
    expect(res.status).toBe(409);
  });
});

describe('login', () => {
  it('rejects wrong password and unknown email with the same response', async () => {
    await signup(app, 'ann');
    const wrong = await request(app).post(`${api}/login`).send({ email: 'ann@example.com', password: 'WrongPass123' });
    const unknown = await request(app).post(`${api}/login`).send({ email: 'ghost@example.com', password: 'WrongPass123' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('blocks NoSQL operator injection', async () => {
    const res = await request(app).post(`${api}/login`).send({ email: { $gt: '' }, password: 'x' });
    expect(res.status).toBe(422);
  });

  it('sets an HttpOnly, SameSite=Strict refresh cookie scoped to the auth path', async () => {
    await request(app).post(`${api}/register`).send({ email: 'ann@example.com', name: 'Ann', password: PASSWORD });
    const res = await request(app).post(`${api}/login`).send({ email: 'ann@example.com', password: PASSWORD });
    const cookie = ([] as string[]).concat(res.headers['set-cookie'] as unknown as string[]).join(';').toLowerCase();
    expect(cookie).toContain('httponly');
    expect(cookie).toContain('samesite=strict');
    expect(cookie).toContain('path=/api/v1/auth');
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('locks the account after 5 failed attempts', async () => {
    await request(app).post(`${api}/register`).send({ email: 'ann@example.com', name: 'Ann', password: PASSWORD });
    for (let i = 0; i < 5; i++) {
      const bad = await request(app).post(`${api}/login`).send({ email: 'ann@example.com', password: 'WrongPass123' });
      expect(bad.status).toBe(401);
    }
    const locked = await request(app).post(`${api}/login`).send({ email: 'ann@example.com', password: PASSWORD });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('ACCOUNT_LOCKED');
  });
});

describe('access tokens', () => {
  it('GET /me requires a valid token', async () => {
    const a = await signup(app, 'ann');
    expect((await request(app).get(`${api}/me`)).status).toBe(401);
    expect((await request(app).get(`${api}/me`).set(bearer('garbage'))).status).toBe(401);
    expect((await request(app).get(`${api}/me`).set(bearer(`${a.token}x`))).status).toBe(401);
    const ok = await request(app).get(`${api}/me`).set(bearer(a.token));
    expect(ok.status).toBe(200);
    expect(ok.body.data.user.email).toBe('ann@example.com');
  });
});

describe('refresh token rotation', () => {
  it('rotates the token and returns a working access token', async () => {
    const a = await signup(app, 'ann');
    const r1 = await request(app).post(`${api}/refresh`).set('Cookie', a.refreshCookie);
    expect(r1.status).toBe(200);
    expect(refreshCookieFrom(r1)).not.toBe(a.refreshCookie);
    const me = await request(app).get(`${api}/me`).set(bearer(r1.body.data.accessToken));
    expect(me.status).toBe(200);
  });

  it('detects replay of a used token and revokes the whole family', async () => {
    const a = await signup(app, 'ann');
    const r1 = await request(app).post(`${api}/refresh`).set('Cookie', a.refreshCookie);
    const newest = refreshCookieFrom(r1);
    const replay = await request(app).post(`${api}/refresh`).set('Cookie', a.refreshCookie);
    expect(replay.status).toBe(401);
    const afterReplay = await request(app).post(`${api}/refresh`).set('Cookie', newest);
    expect(afterReplay.status).toBe(401); // legitimate holder is logged out too
  });

  it('rejects a missing cookie and an untrusted Origin', async () => {
    const a = await signup(app, 'ann');
    expect((await request(app).post(`${api}/refresh`)).status).toBe(401);
    const evil = await request(app).post(`${api}/refresh`).set('Cookie', a.refreshCookie).set('Origin', 'https://evil.example');
    expect(evil.status).toBe(403);
  });
});

describe('logout & revocation', () => {
  it('logout revokes the refresh token', async () => {
    const a = await signup(app, 'ann');
    const out = await request(app).post(`${api}/logout`).set('Cookie', a.refreshCookie);
    expect(out.status).toBe(200);
    const again = await request(app).post(`${api}/refresh`).set('Cookie', a.refreshCookie);
    expect(again.status).toBe(401);
  });

  it('logout-all revokes every session of the user', async () => {
    const a = await signup(app, 'ann');
    const second = await request(app).post(`${api}/login`).send({ email: a.email, password: a.password });
    await request(app).post(`${api}/logout-all`).set(bearer(a.token)).expect(200);
    expect((await request(app).post(`${api}/refresh`).set('Cookie', a.refreshCookie)).status).toBe(401);
    expect((await request(app).post(`${api}/refresh`).set('Cookie', refreshCookieFrom(second))).status).toBe(401);
  });
});

describe('email verification', () => {
  it('verifies once with the emailed token', async () => {
    const a = await signup(app, 'ann');
    const token = tokenFrom(mailer.outbox[0]!.text);
    expect(token).not.toBe('');
    await request(app).post(`${api}/verify-email`).send({ token }).expect(200);
    const me = await request(app).get(`${api}/me`).set(bearer(a.token));
    expect(me.body.data.user.emailVerified).toBe(true);
    expect((await request(app).post(`${api}/verify-email`).send({ token })).status).toBe(400); // single use
  });

  it('rejects an invalid token', async () => {
    const res = await request(app).post(`${api}/verify-email`).send({ token: 'not-a-real-token-value' });
    expect(res.status).toBe(400);
  });
});

describe('password reset', () => {
  it('does not reveal whether an email exists', async () => {
    await signup(app, 'ann');
    mailer.outbox.length = 0;
    const known = await request(app).post(`${api}/forgot-password`).send({ email: 'ann@example.com' });
    const unknown = await request(app).post(`${api}/forgot-password`).send({ email: 'ghost@example.com' });
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(known.body).toEqual(unknown.body);
    expect(mailer.outbox).toHaveLength(1); // only the real account got a message
  });

  it('resets the password and revokes existing sessions', async () => {
    const a = await signup(app, 'ann');
    mailer.outbox.length = 0;
    await request(app).post(`${api}/forgot-password`).send({ email: a.email }).expect(202);
    const token = tokenFrom(mailer.outbox[0]!.text);

    const weak = await request(app).post(`${api}/reset-password`).send({ token, password: 'short' });
    expect(weak.status).toBe(422);

    await request(app).post(`${api}/reset-password`).send({ token, password: 'NewPassw0rd!abc' }).expect(200);
    expect((await request(app).post(`${api}/refresh`).set('Cookie', a.refreshCookie)).status).toBe(401);
    expect((await request(app).post(`${api}/login`).send({ email: a.email, password: a.password })).status).toBe(401);
    expect((await request(app).post(`${api}/login`).send({ email: a.email, password: 'NewPassw0rd!abc' })).status).toBe(200);
    expect((await request(app).post(`${api}/reset-password`).send({ token, password: 'AnotherPassw0rd!' })).status).toBe(400); // single use
  });
});
