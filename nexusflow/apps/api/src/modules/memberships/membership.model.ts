import { Schema, model, type InferSchemaType } from 'mongoose';
import { ROLES } from '../../shared/constants';
import { baseOptions, oid } from '../../shared/schema';

/** Source of truth for "who belongs to which workspace, with which role". */
const membershipSchema = new Schema(
  {
    workspaceId: oid('Workspace', true),
    userId: oid('User', true),
    role: { type: String, enum: [...ROLES], required: true, default: 'MEMBER' },
    invitedBy: oid('User'),
    joinedAt: { type: Date, default: Date.now },
  },
  baseOptions(),
);
membershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
membershipSchema.index({ workspaceId: 1, role: 1 });
membershipSchema.index({ userId: 1 }); // "my workspaces"

export type MembershipAttrs = InferSchemaType<typeof membershipSchema>;
export const Membership = model('Membership', membershipSchema);
