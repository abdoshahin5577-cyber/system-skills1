import type { Request, RequestHandler } from 'express';
import { Types } from 'mongoose';
import { Membership } from '../modules/memberships/membership.model';
import { Workspace } from '../modules/workspaces/workspace.model';
import { can, type Permission } from '../modules/rbac/permissions';
import type { Role } from '../shared/constants';
import { asyncHandler } from '../shared/asyncHandler';
import { Errors } from '../shared/errors';
import { getAuth } from './authenticate';

export interface TenantContext {
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

/**
 * THE single place where a client-supplied :workspaceId becomes trusted.
 * The id is only accepted if the authenticated user has a membership in that workspace.
 * Anything else (not a member, workspace missing/deleted, malformed id) is an identical 404,
 * so ids of other tenants cannot be probed.
 */
export const resolveTenant: RequestHandler = asyncHandler(async (req, _res, next) => {
  const { userId } = getAuth(req);
  const raw = req.params.workspaceId;
  if (!raw || !/^[a-f\d]{24}$/i.test(raw)) throw Errors.notFound('Workspace not found');

  const workspaceId = new Types.ObjectId(raw);
  const userObjectId = new Types.ObjectId(userId);

  const membership = await Membership.findOne({ workspaceId, userId: userObjectId }).lean();
  if (!membership) throw Errors.notFound('Workspace not found');

  const workspace = await Workspace.exists({ _id: workspaceId, deletedAt: null });
  if (!workspace) throw Errors.notFound('Workspace not found');

  req.tenant = { workspaceId, userId: userObjectId, role: membership.role as Role };
  next();
});

export function getTenant(req: Request): TenantContext {
  if (!req.tenant) throw Errors.unauthorized();
  return req.tenant;
}

/** Server-side permission check; the frontend's hiding of buttons is cosmetic only. */
export const requirePermission =
  (permission: Permission): RequestHandler =>
  (req, _res, next) => {
    try {
      if (!can(getTenant(req).role, permission)) throw Errors.forbidden();
      next();
    } catch (err) {
      next(err);
    }
  };

/** Base filter for every tenant-owned query: `Model.find({ ...scoped(req), ... })`. */
export const scoped = (req: Request) => ({ workspaceId: getTenant(req).workspaceId });
