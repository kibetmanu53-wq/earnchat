import { z } from 'zod';

const email = z.string().trim().toLowerCase().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address.');
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid identifier.');

export const registerSchema = z.object({
  email,
  displayName: z.string().trim().min(2, 'Display name is too short.').max(80, 'Display name is too long.'),
  password: z.string().min(10, 'Password must be at least 10 characters.').max(256)
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(256)
});

const authToken = z.string().trim().min(20).max(256);

export const verifyEmailSchema = z.object({
  token: authToken
});

export const emailOnlySchema = z.object({
  email
});

export const resetPasswordSchema = z.object({
  token: authToken,
  password: z.string().min(10, 'Password must be at least 10 characters.').max(256)
});

export const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  age: z.coerce.number().int().min(18, 'You must be 18 or older.').max(120).optional(),
  location: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(500).optional(),
  interests: z.string().trim().max(200).optional()
});

export const paymentInitiateSchema = z.object({
  type: z.enum(['verification', 'beginner_membership']),
  phone: z.string().trim().min(9).max(20)
});

export const paymentHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().trim().min(1).max(256).optional()
});

export const membershipSchema = z.object({
  plan: z.enum(['advanced', 'premium'])
});

export const withdrawalSchema = z.object({
  amountKes: z.coerce.number().int().positive(),
  phone: z.string().trim().min(9).max(20).optional()
});

export const eligibleChatSchema = z.object({
  userId: uuid,
  chatReference: z.string().trim().min(8).max(128),
  participantUserIds: z
    .array(uuid)
    .min(2)
    .max(20)
    .refine((ids) => new Set(ids).size === ids.length, 'Participant IDs must be distinct.'),
  completedMinutes: z.coerce.number().int().min(5)
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type EligibleChatInput = z.infer<typeof eligibleChatSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export { z };
