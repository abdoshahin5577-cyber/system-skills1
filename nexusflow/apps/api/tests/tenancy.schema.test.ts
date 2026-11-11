import { describe, expect, it } from 'vitest';
import { globalModels, tenantModels } from '../src/modules';
import { Project, Sprint, Task } from '../src/modules';

/**
 * Structural guard for multi-tenancy: a tenant-owned model that forgets workspaceId,
 * or has no workspace-leading index, fails CI before it can leak data across tenants.
 */
describe('tenant-owned schemas', () => {
  for (const M of tenantModels) {
    describe(M.modelName, () => {
      it('requires workspaceId', () => {
        const path = M.schema.path('workspaceId');
        expect(path, 'workspaceId missing').toBeDefined();
        expect(path.isRequired).toBe(true);
      });

      it('has an index that starts with workspaceId', () => {
        const hasIndex = M.schema.indexes().some(([fields]) => Object.keys(fields)[0] === 'workspaceId');
        expect(hasIndex).toBe(true);
      });
    });
  }

  it('global models are not tenant-owned (explicit allowlist)', () => {
    expect(globalModels.map((m) => m.modelName).sort()).toEqual(['Plan', 'RefreshToken', 'User', 'Workspace']);
  });
});

describe('schema validation rules', () => {
  it('Task rejects missing required fields and invalid enums', () => {
    const err = new Task({ status: 'NOPE', priority: 'SOON' }).validateSync();
    const fields = Object.keys(err?.errors ?? {});
    expect(fields).toEqual(expect.arrayContaining(['workspaceId', 'projectId', 'title', 'status', 'priority']));
  });

  it('Task accepts a valid document', () => {
    const id = () => '507f1f77bcf86cd799439011';
    const err = new Task({
      workspaceId: id(), projectId: id(), reporterId: id(), number: 1, title: 'Ship it',
    }).validateSync();
    expect(err).toBeUndefined();
  });

  it('Project key must be 2-10 uppercase alphanumerics starting with a letter', () => {
    const id = '507f1f77bcf86cd799439011';
    const base = { workspaceId: id, name: 'Nexus', createdBy: id };
    expect(new Project({ ...base, key: 'NEX' }).validateSync()).toBeUndefined();
    expect(new Project({ ...base, key: '1X' }).validateSync()?.errors.key).toBeDefined();
  });

  it('Sprint endDate must be after startDate', () => {
    const id = '507f1f77bcf86cd799439011';
    const s = new Sprint({
      workspaceId: id, projectId: id, name: 'S1',
      startDate: new Date('2026-01-10'), endDate: new Date('2026-01-01'),
    });
    expect(s.validateSync()?.errors.endDate).toBeDefined();
  });
});
