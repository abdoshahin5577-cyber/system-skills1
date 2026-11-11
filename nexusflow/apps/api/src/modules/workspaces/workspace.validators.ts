import { z } from 'zod';
import { objectIdSchema } from '../../shared/validation';

export const ASSIGNABLE_ROLES = ['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'] as const; // OWNER is never assignable via API

const slug = z.string().trim().toLowerCase().min(3).max(48).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase letters, numbers and dashes only');

export const createWorkspaceBody = z
  .object({ name: z.string().trim().min(2).max(80), slug: slug.optional() })
  .strict();

export const updateWorkspaceBody = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    settings: z
      .object({
        timezone: z.string().trim().min(1).max(64).optional(),
        defaultMemberRole: z.enum(['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER']).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((v) => v.name !== undefined || v.settings !== undefined, { message: 'Nothing to update' });

export const deleteWorkspaceBody = z.object({ confirmName: z.string().min(1).max(80) }).strict();

export const memberParams = z.object({ workspaceId: objectIdSchema, userId: objectIdSchema });
export const updateRoleBody = z.object({ role: z.enum(ASSIGNABLE_ROLES) }).strict();
