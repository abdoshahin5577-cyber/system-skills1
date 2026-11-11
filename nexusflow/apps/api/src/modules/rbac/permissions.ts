import type { Role } from '../../shared/constants';

export const PERMISSIONS = [
  'workspace:view', 'workspace:manage', 'workspace:delete',
  'member:view', 'member:invite', 'member:remove', 'member:update_role',
  'project:view', 'project:create', 'project:update', 'project:delete',
  'task:view', 'task:create', 'task:assign', 'task:update', 'task:delete',
  'comment:create', 'analytics:view', 'billing:manage', 'ai:use',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const VIEW: Permission[] = ['workspace:view', 'member:view', 'project:view', 'task:view'];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  OWNER: new Set<Permission>(PERMISSIONS),
  ADMIN: new Set<Permission>(PERMISSIONS.filter((p) => p !== 'workspace:delete' && p !== 'billing:manage')),
  MANAGER: new Set<Permission>([
    ...VIEW, 'project:create', 'project:update', 'task:create', 'task:assign', 'task:update',
    'task:delete', 'comment:create', 'analytics:view', 'ai:use',
  ]),
  MEMBER: new Set<Permission>([...VIEW, 'task:create', 'task:update', 'comment:create', 'ai:use']),
  VIEWER: new Set<Permission>(VIEW),
};

/** Higher number = more powerful. Used to stop privilege escalation when changing roles. */
export const ROLE_RANK: Record<Role, number> = { OWNER: 5, ADMIN: 4, MANAGER: 3, MEMBER: 2, VIEWER: 1 };

export const can = (role: Role, permission: Permission): boolean => ROLE_PERMISSIONS[role].has(permission);
