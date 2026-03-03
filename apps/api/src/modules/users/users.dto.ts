/**
 * Users Module DTOs
 * Input validation schemas for user endpoints
 */

import { z } from 'zod';

/**
 * Update Profile Request
 */
export const updateProfileSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9._-]+$/, 'Username can only contain letters, numbers, dots, underscores, and hyphens').optional(),
  displayName: z.string().min(1).max(50).optional(),
  defaultTeamName: z.string().min(1).max(50).optional(),
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Change Password Request
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Push Subscription Request
 */
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url('Invalid endpoint URL'),
  p256dh: z.string().min(1, 'p256dh key is required'),
  auth: z.string().min(1, 'auth key is required'),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

/**
 * Email Change Request
 */
export const emailChangeRequestSchema = z.object({
  newEmail: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type EmailChangeRequestInput = z.infer<typeof emailChangeRequestSchema>;

/**
 * Verify Email Change Request
 */
export const verifyEmailChangeSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export type VerifyEmailChangeInput = z.infer<typeof verifyEmailChangeSchema>;
