import { z } from 'zod';

const email = z.string().trim().toLowerCase().email().max(254);
const newPassword = z
  .string()
  .min(10, 'must be at least 10 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'must contain a letter')
  .regex(/\d/, 'must contain a number');
const token = z.string().min(10).max(200);

// .strict(): unknown keys are rejected (blocks mass-assignment), and z.string() rejects
// objects such as { "$gt": "" } (blocks NoSQL operator injection).
export const registerBody = z.object({ email, name: z.string().trim().min(1).max(100), password: newPassword }).strict();
export const loginBody = z.object({ email, password: z.string().min(1).max(128) }).strict();
export const verifyEmailBody = z.object({ token }).strict();
export const forgotPasswordBody = z.object({ email }).strict();
export const resetPasswordBody = z.object({ token, password: newPassword }).strict();
