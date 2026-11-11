import { Schema, model, type InferSchemaType } from 'mongoose';
import { NOTIFICATION_TYPES } from '../../shared/constants';
import { baseOptions, oid } from '../../shared/schema';

const notificationSchema = new Schema(
  {
    workspaceId: oid('Workspace', true),
    userId: oid('User', true), // recipient
    type: { type: String, enum: [...NOTIFICATION_TYPES], required: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, maxlength: 1000 },
    entity: {
      kind: { type: String, enum: ['TASK', 'PROJECT', 'COMMENT', 'MESSAGE', 'INVITATION'] },
      id: Schema.Types.ObjectId,
    },
    actorId: oid('User'),
    readAt: Date,
    emailedAt: Date,
    // Prevents duplicate notifications when a job/event is retried.
    dedupeKey: { type: String, maxlength: 200 },
  },
  baseOptions(),
);
notificationSchema.index({ workspaceId: 1, userId: 1, readAt: 1, createdAt: -1 }); // list + unread count
notificationSchema.index(
  { userId: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } },
);

export type NotificationAttrs = InferSchemaType<typeof notificationSchema>;
export const Notification = model('Notification', notificationSchema);
