/**
 * Drafts Module DTOs
 * Input validation schemas for drafts endpoints
 */

import { z } from 'zod';

/**
 * Submit Draft Pick Request
 */
export const submitPickSchema = z.object({
  draftWindowId: z.string().cuid('Invalid draft window ID'),
  leagueMemberId: z.string().cuid('Invalid league member ID'),
  driverId: z.string().cuid('Invalid driver ID'),
});

export type SubmitPickInput = z.infer<typeof submitPickSchema>;

/**
 * Set Auto Draft Preferences Request
 */
export const setAutoDraftPreferencesSchema = z.object({
  preferences: z.array(
    z.object({
      driverId: z.string().cuid('Invalid driver ID'),
      rank: z.number().int().min(1),
    })
  ).min(1, 'At least one preference is required'),
});

export type SetAutoDraftPreferencesInput = z.infer<typeof setAutoDraftPreferencesSchema>;

/**
 * Path parameters for draft window ID
 */
export const draftIdParamSchema = z.object({
  draftId: z.string().cuid('Invalid draft ID'),
});

export type DraftIdParam = z.infer<typeof draftIdParamSchema>;

/**
 * Path parameters for league draft operations
 */
export const leagueDraftsParamSchema = z.object({
  id: z.string().cuid('Invalid league ID'),
});

export type LeagueDraftsParam = z.infer<typeof leagueDraftsParamSchema>;
