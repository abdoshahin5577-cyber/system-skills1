import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission, resolveTenant } from '../../middleware/tenant';
import { validate } from '../../middleware/validate';
import { paginationQuery } from '../../shared/validation';
import { workspaceController as c } from './workspace.controller';
import {
  createWorkspaceBody, deleteWorkspaceBody, memberParams, updateRoleBody, updateWorkspaceBody,
} from './workspace.validators';

export function createWorkspaceRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.post('/', validate({ body: createWorkspaceBody }), c.create);
  router.get('/', c.listMine);

  // Everything below is tenant-scoped: resolveTenant verifies membership BEFORE any handler runs.
  const tenant = Router({ mergeParams: true });
  tenant.use(resolveTenant);

  tenant.get('/', requirePermission('workspace:view'), c.get);
  tenant.patch('/', requirePermission('workspace:manage'), validate({ body: updateWorkspaceBody }), c.update);
  tenant.delete('/', requirePermission('workspace:delete'), validate({ body: deleteWorkspaceBody }), c.remove);

  tenant.get('/members', requirePermission('member:view'), validate({ query: paginationQuery }), c.listMembers);
  tenant.patch(
    '/members/:userId',
    requirePermission('member:update_role'),
    validate({ params: memberParams, body: updateRoleBody }),
    c.updateRole,
  );
  tenant.delete('/members/:userId', requirePermission('member:remove'), validate({ params: memberParams }), c.removeMember);

  router.use('/:workspaceId', tenant);
  return router;
}
