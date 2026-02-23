import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { LeaguesController } from './leagues.controller';
import { LeaguesService } from './leagues.service';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../../lib/auth';

const prisma = new PrismaClient();
const leaguesService = new LeaguesService(prisma);
const leaguesController = new LeaguesController(leaguesService);

/**
 * POST /api/v1/leagues
 * Create a new league (authenticated)
 */
async function createLeagueHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await leaguesController.createLeague(request, reply);
}

/**
 * GET /api/v1/leagues
 * Get public leagues (public)
 */
async function getPublicLeaguesHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await leaguesController.getPublicLeagues(request, reply);
}

/**
 * GET /api/v1/leagues/:id
 * Get league by ID
 */
async function getLeagueHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await leaguesController.getLeague(request, reply);
}

/**
 * GET /api/v1/users/me/leagues
 * Get user's leagues (authenticated)
 */
async function getUserLeaguesHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await leaguesController.getUserLeagues(request, reply);
}

/**
 * Register league routes
 */
export async function leaguesRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/leagues', { preHandler: authenticate }, createLeagueHandler);
  fastify.get('/leagues', getPublicLeaguesHandler);
  fastify.get('/leagues/:id', getLeagueHandler);
  fastify.get('/users/me/leagues', { preHandler: authenticate }, getUserLeaguesHandler);
}