/**
 * Scoring Module DTOs
 * Input validation schemas for scoring endpoints
 */

import { z } from 'zod';

/**
 * Query parameters for race scores
 */
export const raceScoresParamSchema = z.object({
  id: z.string().cuid('Invalid league ID'),
  round: z.coerce.number().int().min(1).max(25),
});

export type RaceScoresParam = z.infer<typeof raceScoresParamSchema>;

/**
 * Calculate Race Scores Request
 */
export const calculateRaceScoresSchema = z.object({
  raceId: z.string().cuid('Invalid race ID'),
});

export type CalculateRaceScoresInput = z.infer<typeof calculateRaceScoresSchema>;
