/**
 * Scoring Controller
 * HTTP handlers for scoring and standings endpoints
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import ScoringService from './scoring.service';
import { StandingsEntry, SeasonPodium, WeeklyWinner, LeagueStandingsView, MemberRaceHistory, LeagueDriverStanding } from './types';
import { ApiError, ErrorCode, sendSuccess, sendError, getOptionalUser } from '../../lib/api-response';
import { raceScoresParamSchema } from './scoring.dto';

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
  ): Promise<void> {
    const { id: leagueId } = request.params;

    try {
      const standings = await this.scoringService.getLeagueStandings(leagueId);
      sendSuccess(reply, { standings });
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  }

  /**
   * Get race scores for a league
   * GET /api/v1/leagues/:id/races/:round/scores
   */
  async getRaceScores(
    request: FastifyRequest<{ Params: { id: string; round: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const params = raceScoresParamSchema.parse(request.params);
      const leagueId = params.id;
      const round = params.round;

      // Get the league to find season
      const league = await this.prisma.league.findUnique({
        where: { id: leagueId },
        include: { season: true },
      });

      if (!league) {
        throw ApiError.notFound('League');
      }

      // Get the race by round
      const race = await this.prisma.race.findFirst({
        where: {
          seasonId: league.seasonId,
          round,
        },
      });

      if (!race) {
        throw ApiError.notFound('Race');
      }

      const scores = await this.scoringService.getRaceScoresForLeague(leagueId, race.id);
      sendSuccess(reply, { scores });
    } catch (error) {
      request.log.error(error);
      if (error instanceof z.ZodError) {
        sendError(reply, ApiError.validationError(error.errors));
      } else {
        sendError(reply, error);
      }
    }
  }

  /**
   * Admin: Calculate scores for a race
   * POST /api/v1/admin/scoring/calculate/:raceId
   */
  async calculateRaceScores(
    request: FastifyRequest<{ Params: { raceId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { raceId } = request.params;

    try {
      const result = await this.scoringService.calculateAndSaveAllLeagueScores(raceId);
      
      if (result.errors.length > 0) {
        request.log.error({ errors: result.errors }, '[ScoringController] Errors during score calculation');
      }
      
      sendSuccess(reply, result);
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  }

  /**
   * Admin: Recalculate all scores for a league
   * POST /api/v1/admin/scoring/recalculate/:leagueId
   */
  async recalculateLeagueScores(
    request: FastifyRequest<{ Params: { leagueId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { leagueId } = request.params;

    try {
      await this.scoringService.recalculateAllLeagueScores(leagueId);
      sendSuccess(reply, { message: 'Scores recalculated successfully' });
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  }

  /**
   * Get season podium for a league
   * GET /api/v1/leagues/:id/podium
   */
  async getSeasonPodium(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { id: leagueId } = request.params;

    try {
      const podium = await this.scoringService.getSeasonPodium(leagueId);
      sendSuccess(reply, podium);
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  }

  /**
   * Get all weekly winners for a league
   * GET /api/v1/leagues/:id/weekly-winners
   */
  async getWeeklyWinners(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { id: leagueId } = request.params;

    try {
      const weeklyWinners = await this.scoringService.getWeeklyWinners(leagueId);
      sendSuccess(reply, { weeklyWinners });
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  }

  /**
   * Get weekly winner for a specific race
   * GET /api/v1/leagues/:id/races/:round/weekly-winner
   */
  async getRaceWeeklyWinner(
    request: FastifyRequest<{ Params: { id: string; round: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const params = raceScoresParamSchema.parse(request.params);
      const leagueId = params.id;
      const round = params.round;

      // Get the league to find season
      const league = await this.prisma.league.findUnique({
        where: { id: leagueId },
        include: { season: true },
      });

      if (!league) {
        throw ApiError.notFound('League');
      }

      // Get the race by round
      const race = await this.prisma.race.findFirst({
        where: {
          seasonId: league.seasonId,
          round,
        },
      });

      if (!race) {
        throw ApiError.notFound('Race');
      }

      const weeklyWinner = await this.scoringService.getWeeklyWinnerForRace(leagueId, race.id);
      sendSuccess(reply, { weeklyWinner });
    } catch (error) {
      request.log.error(error);
      if (error instanceof z.ZodError) {
        sendError(reply, ApiError.validationError(error.errors));
      } else {
        sendError(reply, error);
      }
    }
  }

  /**
   * Get complete league standings view with draft status
   * GET /api/v1/leagues/:id/standings-view
   */
  async getLeagueStandingsView(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { id: leagueId } = request.params;

    try {
      // Check visibility for non-members
      const league = await this.prisma.league.findUnique({
        where: { id: leagueId },
        select: { visibility: true },
      });

      if (!league) {
        throw ApiError.notFound('League');
      }

      // For private leagues, would need auth check here
      // For now, allow access to all

      const view = await this.scoringService.getLeagueStandingsView(leagueId);
      sendSuccess(reply, view);
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  }

  /**
   * Get league-specific driver standings (based on league's scoring type)
   * GET /api/v1/leagues/:id/driver-standings
   */
  async getLeagueDriverStandings(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { id: leagueId } = request.params;

    try {
      const driverStandings = await this.scoringService.getLeagueDriverStandings(leagueId);
      sendSuccess(reply, { driverStandings });
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  }

  /**
   * Get member's race-by-race history
   * GET /api/v1/leagues/:id/members/:memberId/history
   */
  async getMemberRaceHistory(
    request: FastifyRequest<{ Params: { id: string; memberId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { id: leagueId, memberId } = request.params;

    try {
      // Verify member belongs to league
      const member = await this.prisma.leagueMember.findFirst({
        where: {
          id: memberId,
          leagueId,
          leftAt: null,
        },
      });

      if (!member) {
        throw ApiError.notFound('Member in league');
      }

      const history = await this.scoringService.getMemberRaceHistory(memberId);
      sendSuccess(reply, { history });
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  }
}

export default ScoringController;