/**
 * Leagues Module DTOs
 * Input validation schemas for leagues endpoints
 */

import { z } from 'zod';

/**
 * Create League Request
 */
export const createLeagueSchema = z.object({
  name: z.string().min(3, 'League name must be at least 3 characters').max(80, 'League name must be at most 80 characters'),
  seasonId: z.string().cuid('Invalid season ID'),
  scoringType: z.enum(['fia_official', 'linear_20', 'proprietary']).optional().default('proprietary'),
  draftType: z.enum(['snake', 'regular']).optional().default('snake'),
  visibility: z.enum(['public', 'private']).optional().default('private'),
  joinApprovalRequired: z.boolean().optional().default(false),
  targetPlayers: z.number().int().min(2).max(11).optional(),
  maxPlayers: z.number().int().min(2).max(11).optional().default(11),
  missedPickResolution: z.enum(['random', 'top_points', 'no_pick']).optional().default('random'),
  substitutionPolicy: z.enum(['redraft', 'auto_replace']).optional().default('auto_replace'),
  draftOrderRandomized: z.boolean().optional().default(false),
});

export type CreateLeagueInput = z.infer<typeof createLeagueSchema>;

/**
 * Update League Request
 */
export const updateLeagueSchema = z.object({
  name: z.string().min(3).max(80).optional(),
  visibility: z.enum(['public', 'private']).optional(),
  joinApprovalRequired: z.boolean().optional(),
  maxPlayers: z.number().int().min(2).max(11).optional(),
  scoringType: z.enum(['fia_official', 'linear_20', 'proprietary']).optional(),
  draftType: z.enum(['snake', 'regular']).optional(),
  missedPickResolution: z.enum(['random', 'top_points', 'no_pick']).optional(),
  substitutionPolicy: z.enum(['redraft', 'auto_replace']).optional(),
});

export type UpdateLeagueInput = z.infer<typeof updateLeagueSchema>;

/**
 * Join League Request
 */
export const joinLeagueSchema = z.object({
  teamName: z.string().min(1, 'Team name is required').max(50, 'Team name must be at most 50 characters'),
});

export type JoinLeagueInput = z.infer<typeof joinLeagueSchema>;

/**
 * Update Draft Order Request
 */
export const updateDraftOrderSchema = z.object({
  leagueId: z.string().cuid('Invalid league ID'),
  memberDraftOrders: z.array(
    z.object({
      leagueMemberId: z.string().cuid('Invalid member ID'),
      round1PickOrder: z.number().int().min(1),
      round2PickOrder: z.number().int().min(1),
    })
  ).min(1, 'At least one member draft order is required'),
});

export type UpdateDraftOrderInput = z.infer<typeof updateDraftOrderSchema>;

/**
 * Flag Issue Request
 */
export const flagIssueSchema = z.object({
  leagueId: z.string().cuid('Invalid league ID'),
  issue: z.string().min(10, 'Issue description must be at least 10 characters').max(1000, 'Issue description must be at most 1000 characters'),
});

export type FlagIssueInput = z.infer<typeof flagIssueSchema>;

/**
 * Create Invite Link Request
 */
export const createInviteLinkSchema = z.object({
  leagueId: z.string().cuid('Invalid league ID'),
  expiresAt: z.date().optional(),
  maxUses: z.number().int().min(1).optional(),
});

export type CreateInviteLinkInput = z.infer<typeof createInviteLinkSchema>;
