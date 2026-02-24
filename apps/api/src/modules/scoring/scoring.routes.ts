/**
 * Scoring Routes
 * Fastify routes for scoring and standings endpoints
 */

import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { ScoringController } from './scoring.controller';
import { ScoringService } from './scoring.service';

export async function scoringRoutes(fastify: FastifyInstance) {
  const prisma = new PrismaClient();
  const scoringService = new ScoringService(prisma);
  const controller = new ScoringController(scoringService, prisma);

  // Get league standings
  // GET /api/v1/leagues/:id/standings
  fastify.get('/leagues/:id/standings', async (request, reply) => {
    return controller.getLeagueStandings(
      request as any,
      reply
    );
  });

  // Get race scores for a league
  // GET /api/v1/leagues/:id/races/:round/scores
  fastify.get('/leagues/:id/races/:round/scores', async (request, reply) => {
    return controller.getRaceScores(
      request as any,
      reply
    );
  });

  // Get season podium for a league
  // GET /api/v1/leagues/:id/podium
  fastify.get('/leagues/:id/podium', async (request, reply) => {
    return controller.getSeasonPodium(
      request as any,
      reply
    );
  });

  // Get all weekly winners for a league
  // GET /api/v1/leagues/:id/weekly-winners
  fastify.get('/leagues/:id/weekly-winners', async (request, reply) => {
    return controller.getWeeklyWinners(
      request as any,
      reply
    );
  });

  // Get weekly winner for a specific race
  // GET /api/v1/leagues/:id/races/:round/weekly-winner
  fastify.get('/leagues/:id/races/:round/weekly-winner', async (request, reply) => {
    return controller.getRaceWeeklyWinner(
      request as any,
      reply
    );
  });

  // Get complete league standings view with draft status
  // GET /api/v1/leagues/:id/standings-view
  fastify.get('/leagues/:id/standings-view', async (request, reply) => {
    return controller.getLeagueStandingsView(
      request as any,
      reply
    );
  });

  // Get member's race-by-race history
  // GET /api/v1/leagues/:id/members/:memberId/history
  fastify.get('/leagues/:id/members/:memberId/history', async (request, reply) => {
    return controller.getMemberRaceHistory(
      request as any,
      reply
    );
  });

  // Admin: Calculate scores for a race
  // POST /api/v1/admin/scoring/calculate/:raceId
  fastify.post('/admin/scoring/calculate/:raceId', async (request, reply) => {
    return controller.calculateRaceScores(
      request as any,
      reply
    );
  });

  // Admin: Recalculate all scores for a league
  // POST /api/v1/admin/scoring/recalculate/:leagueId
  fastify.post('/admin/scoring/recalculate/:leagueId', async (request, reply) => {
    return controller.recalculateLeagueScores(
      request as any,
      reply
    );
  });
}

export default scoringRoutes;