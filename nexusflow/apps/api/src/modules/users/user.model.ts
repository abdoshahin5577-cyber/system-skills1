import { Schema, model, type InferSchemaType } from 'mongoose';
import { baseOptions, oid } from '../../shared/schema';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    passwordHash: { type: String, required: true, select: false },
    avatarUrl: { type: String, maxlength: 2048 },
    emailVerifiedAt: Date,
    lastLoginAt: Date,
    failedLoginCount: { type: Number, default: 0, min: 0 },
    lockedUntil: Date,
    passwordChangedAt: Date,
    // Only hashes of one-time tokens are stored; raw tokens are emailed and never persisted.
    emailVerificationTokenHash: { type: String, select: false },
    emailVerificationExpiresAt: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
    preferences: {
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
      lastWorkspaceId: oid('Workspace'),
    },
  },
  baseOptions(),
);
userSchema.index({ emailVerificationTokenHash: 1 }, { sparse: true });
userSchema.index({ passwordResetTokenHash: 1 }, { sparse: true });

export type UserAttrs = InferSchemaType<typeof userSchema>;
export const User = model('User', userSchema);
