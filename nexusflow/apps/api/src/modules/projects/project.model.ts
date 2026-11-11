import { Schema, model, type InferSchemaType } from 'mongoose';
import { PROJECT_STATUSES } from '../../shared/constants';
import { baseOptions, oid } from '../../shared/schema';

const projectSchema = new Schema(
  {
    workspaceId: oid('Workspace', true),
    key: { type: String, required: true, uppercase: true, match: /^[A-Z][A-Z0-9]{1,9}$/ },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    description: { type: String, maxlength: 5000 },
    status: { type: String, enum: [...PROJECT_STATUSES], default: 'PLANNING', required: true },
    managerId: oid('User'),
    memberIds: [oid('User')],
    deadline: Date,
    archivedAt: Date,
    // Atomically incremented ($inc) to give each task a human-friendly number (e.g. NEX-42).
    taskCounter: { type: Number, default: 0, min: 0 },
    createdBy: oid('User', true),
  },
  baseOptions(),
);
projectSchema.index({ workspaceId: 1, key: 1 }, { unique: true });
projectSchema.index({ workspaceId: 1, status: 1, updatedAt: -1 });
projectSchema.index({ workspaceId: 1, memberIds: 1 });

export type ProjectAttrs = InferSchemaType<typeof projectSchema>;
export const Project = model('Project', projectSchema);
