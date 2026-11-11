import { Schema, model, type InferSchemaType } from 'mongoose';
import { ROLES } from '../../shared/constants';
import { baseOptions, oid } from '../../shared/schema';

const workspaceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      minlength: 3,
      maxlength: 48,
    },
    ownerId: oid('User', true),
    settings: {
      timezone: { type: String, default: 'UTC' },
      defaultMemberRole: { type: String, enum: ROLES.filter((r) => r !== 'OWNER'), default: 'MEMBER' },
    },
    // Soft delete: deletion is scheduled first so it can be cancelled; purge job comes later.
    deletedAt: Date,
    deletionScheduledFor: Date,
  },
  baseOptions(),
);
workspaceSchema.index({ ownerId: 1 });
workspaceSchema.index({ deletedAt: 1 }, { sparse: true });

export type WorkspaceAttrs = InferSchemaType<typeof workspaceSchema>;
export const Workspace = model('Workspace', workspaceSchema);
