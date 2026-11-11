import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { env } from '../../config/env';
import type { Mailer } from '../../infra/mailer';
import { AppError, Errors } from '../../shared/errors';
import { RefreshToken } from './refreshToken.model';
import { User } from '../users/user.model';
import { dummyHash, hashPassword, verifyPassword } from './password';
import { hashToken, randomToken, signAccessToken } from './token.utils';

const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60 * 1000;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

export interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

type UserDoc = NonNullable<Awaited<ReturnType<typeof User.findById>>>;

export const toPublicUser = (u: UserDoc) => ({
  id: u._id.toString(),
  email: u.email,
  name: u.name,
  avatarUrl: u.avatarUrl ?? null,
  emailVerified: Boolean(u.emailVerifiedAt),
  createdAt: u.createdAt,
});

export function createAuthService(mailer: Mailer) {
  async function issueSession(userId: Types.ObjectId, meta: SessionMeta, familyId = randomUUID()): Promise<Session> {
    const refreshToken = randomToken();
    const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    await RefreshToken.create({
      userId,
      familyId,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshExpiresAt,
      userAgent: meta.userAgent?.slice(0, 512),
      ip: meta.ip,
    });
    return { accessToken: signAccessToken(userId.toString()), refreshToken, refreshExpiresAt };
  }

  const revokeFamily = (familyId: string) =>
    RefreshToken.updateMany({ familyId, revokedAt: null }, { $set: { revokedAt: new Date() } });

  return {
    async register(input: { email: string; name: string; password: string }) {
      if (await User.exists({ email: input.email })) throw Errors.conflict('Email is already registered');
      const verifyToken = randomToken(32);
      const user = await User.create({
        email: input.email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
        emailVerificationTokenHash: hashToken(verifyToken),
        emailVerificationExpiresAt: new Date(Date.now() + VERIFY_TTL_MS),
      });
      await mailer.send({
        to: user.email,
        subject: 'Verify your NexusFlow email',
        text: `Confirm your email: ${env.CLIENT_URL}/verify-email?token=${verifyToken}`,
      });
      return toPublicUser(user);
    },

    async login(input: { email: string; password: string }, meta: SessionMeta) {
      const user = await User.findOne({ email: input.email }).select('+passwordHash');
      if (!user) {
        await verifyPassword(await dummyHash(), input.password); // equalise timing
        throw Errors.unauthorized('Invalid email or password');
      }
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw new AppError(429, 'ACCOUNT_LOCKED', 'Too many failed attempts. Try again later.');
      }
      if (!(await verifyPassword(user.passwordHash, input.password))) {
        const updated = await User.findByIdAndUpdate(user._id, { $inc: { failedLoginCount: 1 } }, { new: true });
        if (updated && updated.failedLoginCount >= MAX_FAILED_LOGINS) {
          await User.updateOne(
            { _id: user._id },
            { $set: { lockedUntil: new Date(Date.now() + LOCK_MS), failedLoginCount: 0 } },
          );
        }
        throw Errors.unauthorized('Invalid email or password');
      }
      await User.updateOne(
        { _id: user._id },
        { $set: { failedLoginCount: 0, lastLoginAt: new Date() }, $unset: { lockedUntil: 1 } },
      );
      return { user: toPublicUser(user), session: await issueSession(user._id, meta) };
    },

    /**
     * Rotation with reuse detection. Each refresh token is single-use. Presenting an
     * already-used token means it was stolen or replayed => the whole token family is revoked.
     */
    async refresh(rawToken: string, meta: SessionMeta): Promise<Session> {
      const existing = await RefreshToken.findOne({ tokenHash: hashToken(rawToken) });
      if (!existing) throw Errors.unauthorized('Invalid refresh token');
      if (existing.revokedAt) {
        await revokeFamily(existing.familyId);
        throw Errors.unauthorized('Refresh token reuse detected');
      }
      if (existing.expiresAt <= new Date()) throw Errors.unauthorized('Refresh token expired');

      const nextToken = randomToken();
      // Atomic claim: only one concurrent request can rotate this token.
      const claimed = await RefreshToken.findOneAndUpdate(
        { _id: existing._id, revokedAt: null },
        { $set: { revokedAt: new Date(), replacedByTokenHash: hashToken(nextToken) } },
      );
      if (!claimed) {
        await revokeFamily(existing.familyId);
        throw Errors.unauthorized('Refresh token reuse detected');
      }
      if (!(await User.exists({ _id: existing.userId }))) {
        await revokeFamily(existing.familyId);
        throw Errors.unauthorized('Invalid refresh token');
      }
      await RefreshToken.create({
        userId: existing.userId,
        familyId: existing.familyId,
        tokenHash: hashToken(nextToken),
        expiresAt: existing.expiresAt, // rotation does not extend the session lifetime
        userAgent: meta.userAgent?.slice(0, 512),
        ip: meta.ip,
      });
      return { accessToken: signAccessToken(existing.userId.toString()), refreshToken: nextToken, refreshExpiresAt: existing.expiresAt };
    },

    async logout(rawToken?: string) {
      if (!rawToken) return;
      const existing = await RefreshToken.findOne({ tokenHash: hashToken(rawToken) });
      if (existing) await revokeFamily(existing.familyId);
    },

    async logoutAll(userId: string) {
      await RefreshToken.updateMany({ userId: new Types.ObjectId(userId), revokedAt: null }, { $set: { revokedAt: new Date() } });
    },

    async getMe(userId: string) {
      const user = await User.findById(userId);
      if (!user) throw Errors.unauthorized();
      return toPublicUser(user);
    },

    async verifyEmail(token: string) {
      const user = await User.findOneAndUpdate(
        { emailVerificationTokenHash: hashToken(token), emailVerificationExpiresAt: { $gt: new Date() } },
        { $set: { emailVerifiedAt: new Date() }, $unset: { emailVerificationTokenHash: 1, emailVerificationExpiresAt: 1 } },
        { new: true },
      );
      if (!user) throw Errors.badRequest('Invalid or expired verification token');
    },

    /** Always resolves the same way, whether or not the email exists (no account enumeration). */
    async forgotPassword(email: string) {
      const user = await User.findOne({ email });
      if (!user) return;
      const resetToken = randomToken(32);
      await User.updateOne(
        { _id: user._id },
        { $set: { passwordResetTokenHash: hashToken(resetToken), passwordResetExpiresAt: new Date(Date.now() + RESET_TTL_MS) } },
      );
      await mailer.send({
        to: user.email,
        subject: 'Reset your NexusFlow password',
        text: `Reset your password (valid for 1 hour): ${env.CLIENT_URL}/reset-password?token=${resetToken}`,
      });
    },

    async resetPassword(token: string, password: string) {
      const passwordHash = await hashPassword(password);
      const user = await User.findOneAndUpdate(
        { passwordResetTokenHash: hashToken(token), passwordResetExpiresAt: { $gt: new Date() } },
        {
          $set: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0 },
          $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1, lockedUntil: 1 },
        },
        { new: true },
      );
      if (!user) throw Errors.badRequest('Invalid or expired reset token');
      // A password reset must kill every existing session.
      await RefreshToken.updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
