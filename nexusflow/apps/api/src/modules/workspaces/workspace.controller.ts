import { getAuth } from '../../middleware/authenticate';
import { getTenant } from '../../middleware/tenant';
import { asyncHandler } from '../../shared/asyncHandler';
import { buildPageMeta, sendSuccess } from '../../shared/response';
import { workspaceService } from './workspace.service';

export const workspaceController = {
  create: asyncHandler(async (req, res) => {
    sendSuccess(res, await workspaceService.create(getAuth(req).userId, req.body), { status: 201 });
  }),

  listMine: asyncHandler(async (req, res) => {
    sendSuccess(res, await workspaceService.listMine(getAuth(req).userId));
  }),

  get: asyncHandler(async (req, res) => {
    sendSuccess(res, await workspaceService.get(getTenant(req)));
  }),

  update: asyncHandler(async (req, res) => {
    sendSuccess(res, await workspaceService.update(getTenant(req), req.body));
  }),

  remove: asyncHandler(async (req, res) => {
    sendSuccess(res, await workspaceService.requestDelete(getTenant(req), req.body.confirmName));
  }),

  listMembers: asyncHandler(async (req, res) => {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const { items, total } = await workspaceService.listMembers(getTenant(req), page, limit);
    sendSuccess(res, items, { meta: buildPageMeta(page, limit, total) });
  }),

  updateRole: asyncHandler(async (req, res) => {
    sendSuccess(res, await workspaceService.updateMemberRole(getTenant(req), req.params.userId as string, req.body.role));
  }),

  removeMember: asyncHandler(async (req, res) => {
    sendSuccess(res, await workspaceService.removeMember(getTenant(req), req.params.userId as string));
  }),
};
