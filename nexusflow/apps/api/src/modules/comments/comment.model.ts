import { Schema, model, type InferSchemaType } from 'mongoose';
import { baseOptions, oid } from '../../shared/schema';

const commentSchema = new Schema(
  {
    workspaceId: oid('Workspace', true),
    taskId: oid('Task', true),
    authorId: oid('User', true),
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 10000 },
    mentions: [oid('User')],
    editedAt: Date,
    deletedAt: Date,
  },
  baseOptions(),
);
commentSchema.index({ workspaceId: 1, taskId: 1, createdAt: 1 });
commentSchema.index({ workspaceId: 1, mentions: 1 }, { sparse: true });

export type CommentAttrs = InferSchemaType<typeof commentSchema>;
export const Comment = model('Comment', commentSchema);
