import { Schema, model, type InferSchemaType } from 'mongoose';
import { TASK_PRIORITIES, TASK_STATUSES } from '../../shared/constants';
import { baseOptions, oid } from '../../shared/schema';

const taskSchema = new Schema(
  {
    workspaceId: oid('Workspace', true),
    projectId: oid('Project', true),
    sprintId: oid('Sprint'),
    parentTaskId: oid('Task'), // subtasks
    number: { type: Number, required: true, min: 1 },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 300 },
    description: { type: String, maxlength: 20000 },
    status: { type: String, enum: [...TASK_STATUSES], default: 'TODO', required: true },
    priority: { type: String, enum: [...TASK_PRIORITIES], default: 'MEDIUM', required: true },
    assigneeIds: [oid('User')],
    reporterId: oid('User', true),
    labels: { type: [{ type: String, trim: true, maxlength: 40 }], default: [] },
    dueDate: Date,
    estimateHours: { type: Number, min: 0, max: 10000 },
    /**
     * Board ordering within (project, status). Fractional indexing: moving a card between
     * neighbours A and B sets position = (A + B) / 2, so a drag writes ONE document.
     * A rebalance job can renumber a column if gaps shrink below float precision.
     */
    position: { type: Number, required: true, default: 0 },
    dependsOn: [oid('Task')],
    completedAt: Date,
  },
  { ...baseOptions(), optimisticConcurrency: true },
);
taskSchema.index({ projectId: 1, number: 1 }, { unique: true });
taskSchema.index({ workspaceId: 1, projectId: 1, status: 1, position: 1 }); // kanban columns
taskSchema.index({ workspaceId: 1, assigneeIds: 1, status: 1 }); // my tasks / workload
taskSchema.index({ workspaceId: 1, sprintId: 1, status: 1 });
taskSchema.index({ workspaceId: 1, dueDate: 1, status: 1 }); // overdue / deadlines
taskSchema.index({ workspaceId: 1, parentTaskId: 1 }, { sparse: true });
// Text search is always prefixed by an equality match on workspaceId (tenant-scoped).
taskSchema.index({ workspaceId: 1, title: 'text', description: 'text' });

export type TaskAttrs = InferSchemaType<typeof taskSchema>;
export const Task = model('Task', taskSchema);
