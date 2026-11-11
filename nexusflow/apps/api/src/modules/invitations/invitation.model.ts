import { Schema, model, type InferSchemaType } from 'mongoose';
import { INVITATION_STATUSES, ROLES } from '../../shared/constants';
import { baseOptions, oid } from '../../shared/schema';

const invitationSchema = new Schema(
  {
    workspaceId: oid('Workspace', true),
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    role: { type: String, enum: ROLES.filter((r) => r !== 'OWNER'), required: true, default: 'MEMBER' },
    tokenHash: { type: String, required: true, unique: true },
    invitedBy: oid('User', true),
    status: { type: String, enum: [...INVITATION_STATUSES], default: 'PENDING', required: true },
    expiresAt: { type: Date, required: true },
    respondedAt: Date,
  },
  baseOptions(),
);
// At most one pending invitation per email per workspace.
invitationSchema.index(
  { workspaceId: 1, email: 1 },
  { unique: true, partialFilterExpression: { status: 'PENDING' } },
);
invitationSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });
invitationSchema.index({ email: 1, status: 1 }); // "my pending invitations"

export type InvitationAttrs = InferSchemaType<typeof invitationSchema>;
export const Invitation = model('Invitation', invitationSchema);
