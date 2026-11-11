import { Schema, model, type InferSchemaType } from 'mongoose';
import { SPRINT_STATUSES } from '../../shared/constants';
import { baseOptions, oid } from '../../shared/schema';

const sprintSchema = new Schema(
  {
    workspaceId: oid('Workspace', true),
    projectId: oid('Project', true),
    name: { type: String, required: true, trim: true, maxlength: 120 },
    goal: { type: String, maxlength: 1000 },
    startDate: { type: Date, required: true },
    endDate: {
      type: Date,
      required: true,
      validate: {
        validator(this: { startDate?: Date }, v: Date) {
          return !this.startDate || v > this.startDate;
        },
        message: 'endDate must be after startDate',
      },
    },
    status: { type: String, enum: [...SPRINT_STATUSES], default: 'PLANNED', required: true },
    completedAt: Date,
  },
  baseOptions(),
);
sprintSchema.index({ workspaceId: 1, projectId: 1, status: 1, startDate: -1 });

export type SprintAttrs = InferSchemaType<typeof sprintSchema>;
export const Sprint = model('Sprint', sprintSchema);
