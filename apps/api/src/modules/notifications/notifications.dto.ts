/**
 * Notifications Module DTOs
 * Input validation schemas for notification endpoints
 */

import { z } from 'zod';

/**
 * Get Notifications Query Parameters
 */
export const getNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  unreadOnly: z.coerce.boolean().optional().default(false),
  type: z.string().optional(),
});

export type GetNotificationsQuery = z.infer<typeof getNotificationsQuerySchema>;

/**
 * Mark as Read Request
 */
export const markAsReadSchema = z.object({
  notificationId: z.string().cuid('Invalid notification ID'),
});

export type MarkAsReadInput = z.infer<typeof markAsReadSchema>;

/**
 * Mark All as Read Request (no params needed, but for consistency)
 */
export const markAllAsReadSchema = z.object({});

export type MarkAllAsReadInput = z.infer<typeof markAllAsReadSchema>;
