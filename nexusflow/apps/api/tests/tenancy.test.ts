import { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Membership, Subscription, Workspace } from '../src/modules';
import { buildTestApp, clearDb, startTestDb, stopTestDb } from './helpers/testApp';
import { bearer, signup } from './helpers/http';

const { app } = buildTestApp();
const ws = '/api/v1/workspaces';

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearDb);

async function createWorkspace(token: string, name: string, slug?: string) {
  const res = await request(app).post(ws).set(bearer(token)).send({ name, slug });
  return res;
}

/** alice owns A, bob owns B, carol is VIEWER in A and MEMBER in B. */
async function setup() {
  const alice = await signup(app, 'alice');
  const bob = await signup(app, 'bob');
  const carol = await signup(app, 'carol');
  const wsA = (await createWorkspace(alice.token, 'Acme')).body.data.id as string;
  const wsB = (await createWorkspace(bob.token, 'Globex')).body.data.id as string;
  await Membership.create([
    { workspaceId: new Types.ObjectId(wsA), userId: new Types.ObjectId(carol.userId), role: 'VIEWER' },
    { workspaceId: new Types.ObjectId(wsB), userId: new Types.ObjectId(carol.userId), role: 'MEMBER' },
  ]);
  return { alice, bob, carol, wsA, wsB };
}

describe('workspace creation', () => {
  it('creates workspace + OWNER membership + FREE subscription atomically', async () => {
    const alice = await signup(app, 'alice');
    const res = await createWorkspace(alice.token, 'Acme');
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('OWNER');
    const id = new Types.ObjectId(res.body.data.id as string);
    expect((await Membership.findOne({ workspaceId: id, userId: alice.userId }))?.role).toBe('OWNER');
    expect((await Subscription.findOne({ workspaceId: id }))?.planTier).toBe('FREE');
  });

  it('requires authentication and rejects duplicate slugs', async () => {
    expect((await request(app).post(ws).send({ name: 'Acme' })).status).toBe(401);
    const alice = await signup(app, 'alice');
    expect((await createWorkspace(alice.token, 'Acme', 'acme-hq')).status).toBe(201);
    expect((await createWorkspace(alice.token, 'Acme 2', 'acme-hq')).status).toBe(409);
  });

  it('lists only the caller\'s workspaces', async () => {
    const { alice, wsA } = await setup();
    const res = await request(app).get(ws).set(bearer(alice.token));
    expect(res.body.data.map((w: { id: string }) => w.id)).toEqual([wsA]);
  });
});

describe('cross-tenant isolation', () => {
  it('a user cannot read, modify or delete another tenant (always 404)', async () => {
    const { alice, wsB } = await setup();
    const h = bearer(alice.token);
    expect((await request(app).get(`${ws}/${wsB}`).set(h)).status).toBe(404);
    expect((await request(app).get(`${ws}/${wsB}/members`).set(h)).status).toBe(404);
    expect((await request(app).patch(`${ws}/${wsB}`).set(h).send({ name: 'Hacked' })).status).toBe(404);
    expect((await request(app).delete(`${ws}/${wsB}`).set(h).send({ confirmName: 'Globex' })).status).toBe(404);
    expect((await Workspace.findById(wsB))?.name).toBe('Globex');
  });

  it('being OWNER of tenant A grants nothing in tenant B', async () => {
    const { alice, bob, wsA, wsB } = await setup();
    const res = await request(app)
      .patch(`${ws}/${wsB}/members/${bob.userId}`)
      .set(bearer(alice.token))
      .send({ role: 'VIEWER' });
    expect(res.status).toBe(404);
    expect((await Membership.findOne({ workspaceId: wsB, userId: bob.userId }))?.role).toBe('OWNER');
    expect(wsA).not.toBe(wsB);
  });

  it('does not let attackers probe which workspace ids exist', async () => {
    const { alice, wsB } = await setup();
    const real = await request(app).get(`${ws}/${wsB}`).set(bearer(alice.token));
    const fake = await request(app).get(`${ws}/${new Types.ObjectId().toString()}`).set(bearer(alice.token));
    const junk = await request(app).get(`${ws}/not-an-id`).set(bearer(alice.token));
    for (const r of [real, fake, junk]) expect(r.status).toBe(404);
    expect(real.body.error.message).toBe(fake.body.error.message);
    expect(real.body.error.code).toBe(junk.body.error.code);
  });

  it('requires authentication on tenant routes', async () => {
    const { wsA } = await setup();
    expect((await request(app).get(`${ws}/${wsA}`)).status).toBe(401);
  });

  it('roles are per workspace (VIEWER in A, MEMBER in B)', async () => {
    const { carol, wsA, wsB } = await setup();
    const h = bearer(carol.token);
    expect((await request(app).get(`${ws}/${wsA}`).set(h)).status).toBe(200);
    expect((await request(app).patch(`${ws}/${wsA}`).set(h).send({ name: 'X Corp' })).status).toBe(403);
    expect((await request(app).patch(`${ws}/${wsB}`).set(h).send({ name: 'X Corp' })).status).toBe(403);
  });
});

describe('RBAC enforcement', () => {
  it('OWNER can update workspace settings; unknown fields are rejected', async () => {
    const { alice, bob, wsA } = await setup();
    const ok = await request(app).patch(`${ws}/${wsA}`).set(bearer(alice.token)).send({ name: 'Acme Inc', settings: { timezone: 'Africa/Cairo' } });
    expect(ok.status).toBe(200);
    expect(ok.body.data.name).toBe('Acme Inc');
    const mass = await request(app).patch(`${ws}/${wsA}`).set(bearer(alice.token)).send({ ownerId: bob.userId });
    expect(mass.status).toBe(422);
  });

  it('members list is paginated and contains no secrets', async () => {
    const { alice, wsA } = await setup();
    const res = await request(app).get(`${ws}/${wsA}/members?limit=1`).set(bearer(alice.token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 1, total: 2, totalPages: 2 });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
  });

  it('prevents privilege escalation when changing roles', async () => {
    const { alice, carol, wsA } = await setup();
    const dave = await signup(app, 'dave');
    await Membership.create({ workspaceId: new Types.ObjectId(wsA), userId: new Types.ObjectId(dave.userId), role: 'MEMBER' });
    const patch = (token: string, userId: string, role: string) =>
      request(app).patch(`${ws}/${wsA}/members/${userId}`).set(bearer(token)).send({ role });

    expect((await patch(alice.token, carol.userId, 'OWNER')).status).toBe(422); // OWNER is not assignable
    expect((await patch(carol.token, dave.userId, 'VIEWER')).status).toBe(403); // VIEWER lacks member:update_role
    expect((await patch(alice.token, carol.userId, 'ADMIN')).status).toBe(200);
    expect((await patch(carol.token, dave.userId, 'ADMIN')).status).toBe(403); // ADMIN cannot grant ADMIN
    expect((await patch(carol.token, alice.userId, 'VIEWER')).status).toBe(403); // cannot touch the OWNER
    expect((await patch(carol.token, dave.userId, 'MANAGER')).status).toBe(200); // below own rank is fine
  });

  it('only OWNER can remove members below them, and the owner cannot be removed', async () => {
    const { alice, carol, wsA } = await setup();
    const del = (token: string, userId: string) => request(app).delete(`${ws}/${wsA}/members/${userId}`).set(bearer(token));
    expect((await del(carol.token, alice.userId)).status).toBe(403);
    expect((await del(alice.token, alice.userId)).status).toBe(403);
    expect((await del(alice.token, carol.userId)).status).toBe(200);
    expect(await Membership.findOne({ workspaceId: wsA, userId: carol.userId })).toBeNull();
  });

  it('workspace deletion needs OWNER, a matching name, and is a soft delete', async () => {
    const { alice, carol, wsA } = await setup();
    await request(app).patch(`${ws}/${wsA}/members/${carol.userId}`).set(bearer(alice.token)).send({ role: 'ADMIN' }).expect(200);
    const del = (token: string, confirmName: string) => request(app).delete(`${ws}/${wsA}`).set(bearer(token)).send({ confirmName });

    expect((await del(carol.token, 'Acme')).status).toBe(403); // ADMIN may not delete
    expect((await del(alice.token, 'Wrong name')).status).toBe(400);
    const ok = await del(alice.token, 'Acme');
    expect(ok.status).toBe(200);
    expect((await request(app).get(`${ws}/${wsA}`).set(bearer(alice.token))).status).toBe(404);
    expect((await Workspace.findById(wsA))?.deletedAt).toBeTruthy(); // still in DB during the grace period
  });
});
