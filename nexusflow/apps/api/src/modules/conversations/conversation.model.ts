import { Schema, model, type InferSchemaType } from 'mongoose';
import { CONVERSATION_TYPES } from '../../shared/constants';
import { baseOptions, oid } from '../../shared/schema';

const conversationSchema = new Schema(
  {
    workspaceId: oid('Workspace', true),
    type: { type: String, enum: [...CONVERSATION_TYPES], required: true },
    name: { type: String, trim: true, maxlength: 80 },
    projectId: oid('Project'),
    memberIds: [oid('User')], // authoritative for DIRECT; CHANNEL/PROJECT derive access from workspace/project
    lastMessageAt: Date,
    createdBy: oid('User', true),
  },
  baseOptions(),
);
conversationSchema.index({ workspaceId: 1, type: 1, lastMessageAt: -1 });
conversationSchema.index({ workspaceId: 1, memberIds: 1 });
conversationSchema.index({ workspaceId: 1, projectId: 1 }, { sparse: true });

export type ConversationAttrs = InferSchemaType<typeof conversationSchema>;
export const Conversation = model('Conversation', conversationSchema);
