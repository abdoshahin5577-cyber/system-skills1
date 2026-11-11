import { Schema, model, type InferSchemaType } from 'mongoose';
import { baseOptions, oid } from '../../shared/schema';

/** Append-only audit trail; never updated after insert. */
const activityLogSchema = new Schema(
  {
    workspaceId: oid('Workspace', true),
    projectId: oid('Project'),
    actorId: oid('User', true),
    action: { type: String, required: true, maxlength: 80 }, // e.g. "task.status_changed"
    entity: {
      kind: { type: String, required: true, maxlength: 40 },
      id: { type: Schema.Types.ObjectId, required: true },
    },
    metadata: { type: Schema.Types.Mixed },
  },
  { ...baseOptions(), timestamps: { createdAt: true, updatedAt: false } },
);
activityLogSchema.index({ workspaceId: 1, createdAt: -1 });
activityLogSchema.index({ workspaceId: 1, projectId: 1, createdAt: -1 });
activityLogSchema.index({ workspaceId: 1, 'entity.kind': 1, 'entity.id': 1, createdAt: -1 });

export type ActivityLogAttrs = InferSchemaType<typeof activityLogSchema>;
export const ActivityLog = model('ActivityLog', activityLogSchema);
