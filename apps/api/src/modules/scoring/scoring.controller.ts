/**
 * Scoring Controller
 * HTTP handlers for scoring and standings endpoints
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import ScoringService from './scoring.service';
import { StandingsEntry, SeasonPodium, WeeklyWinner } from './types';

export class ScoringController {
  private scoringService: ScoringService;
  private prisma: PrismaClient;

  constructor(scoringService: ScoringService, prisma: PrismaClient) {
    this.scoringService = scoringService;
    this.prisma = prisma;
  }

  /**
   * Get league standings
   * GET /api/v1/leagues/:id/standings
   */
  async getLeagueStandings(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<{ standings: StandingsEntry[] }> {
    const { id: leagueId } = request.params;

    try {
      const standings = await this.scoringService.getLeagueStandings(leagueId);
      return { standings };
    } catch (error) {
      reply.code(500);
      throw error;
    }
  }

  /**
   * Get race scores for a league
   * GET /api/v1/leagues/:id/races/:round/scores
   */
  async getRaceScores(
    request: FastifyRequest<{ Params: { id: string; round: string } }>,
    reply: FastifyReply
  ): Promise<{ scores: any[] }> {
    const { id: leagueId, round } = request.params;

    try {
      // Get the league to find season
      const league = await this.prisma.league.findUnique({
        where: { id: leagueId },
        include: { season: true },
      });

      if (!league) {
        reply.code(404);
        throw new Error('League not found');
      }

      // Get the race by round
      const race = await this.prisma.race.findFirst({
        where: {
          seasonId: league.seasonId,
          round: parseInt(round, 10),
        },
      });

      if (!race) {
        reply.code(404);
        throw new Error('Race not found');
      }

      const scores = await this.scoringService.getRaceScoresForLeague(leagueId, race.id);
      return { scores };
    } catch (error) {
      reply.code(500);
      throw error;
    }
  }

  /**
   * Admin: Calculate scores for a race
   * POST /api/v1/admin/scoring/calculate/:raceId
   */
  async calculateRaceScores(
    request: FastifyRequest<{ Params: { raceId: string } }>,
    reply: FastifyReply
  ): Promise<{ leaguesProcessed: number; errors: string[] }> {
    const { raceId } = request.params;

    try {
      const result = await this.scoringService.calculateAndSaveAllLeagueScores(raceId);
      
      if (result.errors.length > 0) {
        console.error('[ScoringController] Errors during score calculation:', result.errors);
      }
      
      return result;
    } catch (error) {
      reply.code(500);
      throw error;
    }
  }

  /**
   * Admin: Recalculate all scores for a league
   * POST /api/v1/admin/scoring/recalculate/:leagueId
   */
  async recalculateLeagueScores(
    request: FastifyRequest<{ Params: { leagueId: string } }>,
    reply: FastifyReply
  ): Promise<{ success: boolean; message: string }> {
    const { leagueId } = request.params;

    try {
      await this.scoringService.recalculateAllLeagueScores(leagueId);
      return { success: true, message: 'Scores recalculated successfully' };
    } catch (error) {
      reply.code(500);
      throw error;
    }
  }

  /**
   * Get season podium for a league
   * GET /api/v1/leagues/:id/podium
   */
  async getSeasonPodium(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<SeasonPodium> {
    const { id: leagueId } = request.params;

    try {
      const podium = await this.scoringService.getSeasonPodium(leagueId);
      return podium;
    } catch (error) {
      reply.code(500);
      throw error;
    }
  }

  /**
   * Get all weekly winners for a league
   * GET /api/v1/leagues/:id/weekly-winners
   */
  async getWeeklyWinners(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<{ weeklyWinners: WeeklyWinner[] }> {
    const { id: leagueId } = request.params;

    try {
      const weeklyWinners = await this.scoringService.getWeeklyWinners(leagueId);
      return { weeklyWinners };
    } catch (error) {
      reply.code(500);
      throw error;
    }
  }

  /**
   * Get weekly winner for a specific race
   * GET /api/v1/leagues/:id/races/:round/weekly-winner
   */
  async getRaceWeeklyWinner(
    request: FastifyRequest<{ Params: { id: string; round: string } }>,
    reply: FastifyReply
  ): Promise<{ weeklyWinner: WeeklyWinner | null }> {
    const { id: leagueId, round } = request.params;

    try {
      // Get the league to find season
      const league = await this.prisma.league.findUnique({
        where: { id: leagueId },
        include: { season: true },
      });

      if (!league) {
        reply.code(404);
        throw new Error('League not found');
      }

      // Get the race by round
      const race = await this.prisma.race.findFirst({
        where: {
          seasonId: league.seasonId,
          round: parseInt(round, 10),
        },
      });

      if (!race) {
        reply.code(404);
        throw new Error('Race not found');
      }

      const weeklyWinner = await this.scoringService.getWeeklyWinnerForRace(leagueId, race.id);
      return { weeklyWinner };
    } catch (error) {
      reply.code(500);
      throw error;
    }
  }
}

export default ScoringController;
