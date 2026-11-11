import { Schema, model, type InferSchemaType } from 'mongoose';
import { baseOptions, oid } from '../../shared/schema';

/**
 * Refresh tokens are stored hashed (SHA-256). `familyId` groups a rotation chain so that
 * replay of an already-rotated token revokes the whole family (reuse detection).
 */
const refreshTokenSchema = new Schema(
  {
    userId: oid('User', true),
    familyId: { type: String, required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    replacedByTokenHash: String,
    userAgent: { type: String, maxlength: 512 },
    ip: { type: String, maxlength: 64 },
  },
  baseOptions(),
);
refreshTokenSchema.index({ userId: 1, familyId: 1 });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL cleanup

export type RefreshTokenAttrs = InferSchemaType<typeof refreshTokenSchema>;
export const RefreshToken = model('RefreshToken', refreshTokenSchema);
