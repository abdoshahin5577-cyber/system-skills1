import { Schema, model, type InferSchemaType } from 'mongoose';
import { baseOptions, oid } from '../../shared/schema';

const readReceiptSchema = new Schema({ userId: oid('User', true), readAt: { type: Date, default: Date.now } }, { _id: false });

const messageSchema = new Schema(
  {
    workspaceId: oid('Workspace', true),
    conversationId: oid('Conversation', true),
    senderId: oid('User', true),
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 10000 },
    mentions: [oid('User')],
    attachmentIds: [oid('Attachment')],
    readBy: [readReceiptSchema],
    // Client-generated id => retries / reconnects cannot create duplicate messages.
    clientMessageId: { type: String, maxlength: 64 },
    editedAt: Date,
    deletedAt: Date,
  },
  baseOptions(),
);
messageSchema.index({ workspaceId: 1, conversationId: 1, createdAt: -1 });
messageSchema.index(
  { conversationId: 1, senderId: 1, clientMessageId: 1 },
  { unique: true, partialFilterExpression: { clientMessageId: { $type: 'string' } } },
);

export type MessageAttrs = InferSchemaType<typeof messageSchema>;
export const Message = model('Message', messageSchema);
