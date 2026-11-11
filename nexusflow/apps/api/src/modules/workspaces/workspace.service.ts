import { randomBytes } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import type { TenantContext } from '../../middleware/tenant';
import type { Role } from '../../shared/constants';
import { Errors } from '../../shared/errors';
import { Membership } from '../memberships/membership.model';
import { ROLE_RANK } from '../rbac/permissions';
import { Subscription } from '../billing/subscription.model';
import { User } from '../users/user.model';
import { Workspace } from './workspace.model';

const DELETION_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

const makeSlug = (name: string): string => {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36) || 'workspace';
  return `${base}-${randomBytes(3).toString('hex')}`;
};

type WorkspaceDoc = NonNullable<Awaited<ReturnType<typeof Workspace.findById>>>;
const toDto = (w: WorkspaceDoc | (Record<string, any> & { _id: Types.ObjectId })) => ({
  id: w._id.toString(),
  name: w.name,
  slug: w.slug,
  ownerId: w.ownerId.toString(),
  settings: w.settings,
  createdAt: w.createdAt,
});

export const workspaceService = {
  /** Workspace + OWNER membership + FREE subscription are created atomically (transaction). */
  async create(userId: string, input: { name: string; slug?: string }) {
    const owner = new Types.ObjectId(userId);
    const session = await mongoose.startSession();
    try {
      let created: WorkspaceDoc | undefined;
      await session.withTransaction(async () => {
        const [ws] = await Workspace.create(
          [{ name: input.name, slug: input.slug ?? makeSlug(input.name), ownerId: owner }],
          { session },
        );
        if (!ws) throw new Error('Workspace creation failed');
        await Membership.create([{ workspaceId: ws._id, userId: owner, role: 'OWNER' }], { session });
        await Subscription.create([{ workspaceId: ws._id, planTier: 'FREE', status: 'ACTIVE' }], { session });
        created = ws;
      });
      if (!created) throw new Error('Workspace creation failed');
      return { ...toDto(created), role: 'OWNER' as Role };
    } finally {
      await session.endSession();
    }
  },

  async listMine(userId: string) {
    const memberships = await Membership.find({ userId: new Types.ObjectId(userId) }).lean();
    const workspaces = await Workspace.find({
      _id: { $in: memberships.map((m) => m.workspaceId) },
      deletedAt: null,
    }).lean();
    const roleById = new Map(memberships.map((m) => [m.workspaceId.toString(), m.role as Role]));
    return workspaces.map((w) => ({ ...toDto(w), role: roleById.get(w._id.toString()) as Role }));
  },

  async get(tenant: TenantContext) {
    const ws = await Workspace.findById(tenant.workspaceId).lean();
    if (!ws) throw Errors.notFound('Workspace not found');
    return { ...toDto(ws), role: tenant.role };
  },

  async update(
    tenant: TenantContext,
    patch: { name?: string; settings?: { timezone?: string; defaultMemberRole?: string } },
  ) {
    const $set: Record<string, unknown> = {};
    if (patch.name !== undefined) $set.name = patch.name;
    if (patch.settings?.timezone !== undefined) $set['settings.timezone'] = patch.settings.timezone;
    if (patch.settings?.defaultMemberRole !== undefined) $set['settings.defaultMemberRole'] = patch.settings.defaultMemberRole;
    const ws = await Workspace.findOneAndUpdate({ _id: tenant.workspaceId }, { $set }, { new: true, runValidators: true }).lean();
    if (!ws) throw Errors.notFound('Workspace not found');
    return { ...toDto(ws), role: tenant.role };
  },

  /** Safeguards: OWNER-only (route), typed name confirmation, soft delete with a 7-day grace period. */
  async requestDelete(tenant: TenantContext, confirmName: string) {
    const ws = await Workspace.findById(tenant.workspaceId);
    if (!ws) throw Errors.notFound('Workspace not found');
    if (ws.name !== confirmName) throw Errors.badRequest('Confirmation name does not match the workspace name');
    const now = new Date();
    ws.deletedAt = now;
    ws.deletionScheduledFor = new Date(now.getTime() + DELETION_GRACE_MS);
    await ws.save();
    return { deletedAt: ws.deletedAt, permanentDeletionAt: ws.deletionScheduledFor };
  },

  async listMembers(tenant: TenantContext, page: number, limit: number) {
    const filter = { workspaceId: tenant.workspaceId };
    const [total, memberships] = await Promise.all([
      Membership.countDocuments(filter),
      Membership.find(filter).sort({ createdAt: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    ]);
    const users = await User.find({ _id: { $in: memberships.map((m) => m.userId) } })
      .select('name email avatarUrl')
      .lean();
    const byId = new Map(users.map((u) => [u._id.toString(), u]));
    const items = memberships.map((m) => {
      const u = byId.get(m.userId.toString());
      return {
        userId: m.userId.toString(),
        role: m.role as Role,
        joinedAt: m.joinedAt,
        name: u?.name ?? null,
        email: u?.email ?? null,
        avatarUrl: u?.avatarUrl ?? null,
      };
    });
    return { items, total };
  },

  /** Anti privilege-escalation: you must outrank the target and can only grant roles below your own. */
  async updateMemberRole(tenant: TenantContext, targetUserId: string, newRole: Role) {
    const target = await Membership.findOne({ workspaceId: tenant.workspaceId, userId: new Types.ObjectId(targetUserId) });
    if (!target) throw Errors.notFound('Member not found');
    const targetRole = target.role as Role;
    if (targetRole === 'OWNER') throw Errors.forbidden('The workspace owner role cannot be changed');
    if (ROLE_RANK[tenant.role] <= ROLE_RANK[targetRole]) throw Errors.forbidden('You cannot modify a member with an equal or higher role');
    if (ROLE_RANK[newRole] >= ROLE_RANK[tenant.role]) throw Errors.forbidden('You cannot grant a role equal to or higher than your own');
    target.role = newRole;
    await target.save();
    return { userId: targetUserId, role: newRole };
  },

  async removeMember(tenant: TenantContext, targetUserId: string) {
    const target = await Membership.findOne({ workspaceId: tenant.workspaceId, userId: new Types.ObjectId(targetUserId) });
    if (!target) throw Errors.notFound('Member not found');
    const targetRole = target.role as Role;
    if (targetRole === 'OWNER') throw Errors.forbidden('The workspace owner cannot be removed');
    if (ROLE_RANK[tenant.role] <= ROLE_RANK[targetRole]) throw Errors.forbidden('You cannot remove a member with an equal or higher role');
    await target.deleteOne();
    return { userId: targetUserId, removed: true };
  },
};
