import { Schema, model, type InferSchemaType } from 'mongoose';
import { ATTACHMENT_STATUSES } from '../../shared/constants';
import { baseOptions, oid } from '../../shared/schema';

const attachmentSchema = new Schema(
  {
    workspaceId: oid('Workspace', true),
    uploaderId: oid('User', true),
    projectId: oid('Project'),
    taskId: oid('Task'),
    messageId: oid('Message'),
    filename: { type: String, required: true, maxlength: 255 },
    mimeType: { type: String, required: true, maxlength: 127 },
    sizeBytes: { type: Number, required: true, min: 0 },
    storageKey: { type: String, required: true }, // object key in S3/Cloudinary; URLs are signed on demand
    status: { type: String, enum: [...ATTACHMENT_STATUSES], default: 'PENDING', required: true },
  },
  baseOptions(),
);
attachmentSchema.index({ workspaceId: 1, taskId: 1 }, { sparse: true });
attachmentSchema.index({ workspaceId: 1, projectId: 1 }, { sparse: true });
attachmentSchema.index({ workspaceId: 1, uploaderId: 1, createdAt: -1 });
attachmentSchema.index({ storageKey: 1 }, { unique: true });

export type AttachmentAttrs = InferSchemaType<typeof attachmentSchema>;
export const Attachment = model('Attachment', attachmentSchema);
