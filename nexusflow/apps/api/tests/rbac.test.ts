import { describe, expect, it } from 'vitest';
import { PERMISSIONS, ROLE_PERMISSIONS, ROLE_RANK, can } from '../src/modules/rbac/permissions';

describe('RBAC permission matrix', () => {
  it('OWNER has every permission', () => {
    for (const p of PERMISSIONS) expect(can('OWNER', p)).toBe(true);
  });

  it('ADMIN cannot delete the workspace or manage billing', () => {
    expect(can('ADMIN', 'workspace:delete')).toBe(false);
    expect(can('ADMIN', 'billing:manage')).toBe(false);
    expect(can('ADMIN', 'member:invite')).toBe(true);
  });

  it('VIEWER is strictly read-only', () => {
    for (const p of ROLE_PERMISSIONS.VIEWER) expect(p.endsWith(':view')).toBe(true);
    expect(can('VIEWER', 'task:create')).toBe(false);
  });

  it('MEMBER cannot assign or delete tasks, MANAGER can', () => {
    expect(can('MEMBER', 'task:assign')).toBe(false);
    expect(can('MEMBER', 'task:delete')).toBe(false);
    expect(can('MANAGER', 'task:assign')).toBe(true);
  });

  it('every role is a subset of the next more powerful role', () => {
    const order = ['VIEWER', 'MEMBER', 'MANAGER', 'ADMIN', 'OWNER'] as const;
    for (let i = 0; i < order.length - 1; i++) {
      for (const p of ROLE_PERMISSIONS[order[i]!]) expect(ROLE_PERMISSIONS[order[i + 1]!].has(p)).toBe(true);
    }
  });

  it('role ranks are strictly ordered', () => {
    expect(ROLE_RANK.OWNER).toBeGreaterThan(ROLE_RANK.ADMIN);
    expect(ROLE_RANK.ADMIN).toBeGreaterThan(ROLE_RANK.MANAGER);
    expect(ROLE_RANK.MANAGER).toBeGreaterThan(ROLE_RANK.MEMBER);
    expect(ROLE_RANK.MEMBER).toBeGreaterThan(ROLE_RANK.VIEWER);
  });
});
