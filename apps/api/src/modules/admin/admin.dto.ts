/**
 * Admin Module DTOs
 * Input validation schemas for admin endpoints
 */

import { z } from 'zod';

/**
 * List Users Query Parameters
 */
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().optional(),
  role: z.enum(['super_admin', 'member']).optional(),
  status: z.enum(['active', 'suspended', 'pending_verification']).optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

/**
 * Update User Request
 */
export const updateUserSchema = z.object({
  userId: z.string().cuid('Invalid user ID'),
  role: z.enum(['super_admin', 'member']).optional(),
  status: z.enum(['active', 'suspended', 'pending_verification']).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/**
 * System Setting Request
 */
export const systemSettingSchema = z.object({
  key: z.string().min(1, 'Setting key is required'),
  value: z.unknown(), // Can be any JSON value
});

export type SystemSettingInput = z.infer<typeof systemSettingSchema>;

/**
 * Enter Race Result Request
 */
export const enterRaceResultSchema = z.object({
  raceId: z.string().cuid('Invalid race ID'),
  driverId: z.string().cuid('Invalid driver ID'),
  position: z.coerce.number().int().min(1),
  points: z.coerce.number().min(0),
  status: z.string().optional(),
  fastestLap: z.coerce.boolean().optional().default(false),
});

export type EnterRaceResultInput = z.infer<typeof enterRaceResultSchema>;

/**
 * Bulk Enter Race Results Request
 */
export const bulkEnterRaceResultsSchema = z.object({
  raceId: z.string().cuid('Invalid race ID'),
  results: z.array(enterRaceResultSchema).min(1, 'At least one result is required'),
});

export type BulkEnterRaceResultsInput = z.infer<typeof bulkEnterRaceResultsSchema>;

/**
 * List Races Query Parameters
 */
export const listRacesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  seasonYear: z.coerce.number().int().min(2000).optional(),
  hasResults: z.coerce.boolean().optional(),
});

export type ListRacesQuery = z.infer<typeof listRacesQuerySchema>;

/**
 * List Audit Logs Query Parameters
 */
export const listAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  action: z.string().optional(),
  entityType: z.string().optional(),
  userId: z.string().optional(),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
