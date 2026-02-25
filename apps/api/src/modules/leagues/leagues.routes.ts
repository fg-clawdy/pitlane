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
 * POST /api/v1/leagues/:id/join
 * Join a league directly (authenticated)
 */
async function joinLeagueHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await leaguesController.joinLeague(request, reply);
}

/**
 * POST /api/v1/leagues/:id/leave
 * Leave a league (authenticated)
 */
async function leaveLeagueHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await leaguesController.leaveLeague(request, reply);
}

/**
 * GET /api/v1/join/:token
 * Get league by invite token (public)
 */
async function getLeagueByInviteTokenHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await leaguesController.getLeagueByInviteToken(request, reply);
}

/**
 * POST /api/v1/join/:token
 * Join league via invite token (authenticated)
 */
async function joinViaInviteTokenHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await leaguesController.joinViaInviteToken(request, reply);
}

/**
 * POST /api/v1/leagues/:id/invite-links
 * Create invite link (authenticated, commissioner)
 */
async function createInviteLinkHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await leaguesController.createInviteLink(request, reply);
}

/**
 * GET /api/v1/leagues/:id/invite-links
 * Get invite links (authenticated, commissioner)
 */
async function getInviteLinksHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await leaguesController.getInviteLinks(request, reply);
}

/**
 * GET /api/v1/leagues/:id/members
 * Get league members (public)
 */
async function getLeagueMembersHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await leaguesController.getLeagueMembers(request, reply);
}

/**
 * DELETE /api/v1/leagues/:id/members/:memberId
 * Remove member from league (authenticated, commissioner)
 */
async function removeMemberHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await leaguesController.removeMember(request, reply);
}

/**
 * GET /api/v1/leagues/:id/join-requests
 * Get join requests (authenticated, commissioner)
 */
async function getJoinRequestsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await leaguesController.getJoinRequests(request, reply);
}

/**
 * GET /api/v1/leagues/:id/join-requests/:requestId
 * Approve/reject join request (authenticated, commissioner)
 */
async function resolveJoinRequestHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await leaguesController.resolveJoinRequest(request, reply);
}

/**
 * PATCH /api/v1/leagues/:id
 * Update league settings (authenticated, commissioner)
 */
async function updateLeagueHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await leaguesController.updateLeague(request, reply);
}

/**
 * DELETE /api/v1/leagues/:id
 * Delete league (authenticated, commissioner)
 */
async function deleteLeagueHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await leaguesController.deleteLeague(request, reply);
}

/**
 * PATCH /api/v1/leagues/:id/draft-order
 * Update draft order (authenticated, commissioner)
 */
async function updateDraftOrderHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await leaguesController.updateDraftOrder(request, reply);
}

/**
 * POST /api/v1/leagues/:id/flag
 * Flag issue to admin (authenticated, commissioner)
 */
async function flagIssueHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await leaguesController.flagIssue(request, reply);
}

/**
 * Register league routes
 */
export async function leaguesRoutes(fastify: FastifyInstance): Promise<void> {
  // League CRUD
  fastify.post('/leagues', {
    preHandler: authenticate,
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 day',
        keyGenerator: (request: FastifyRequest) => (request as any).user?.id || request.ip,
      },
    },
  }, createLeagueHandler);
  
  fastify.get('/leagues', getPublicLeaguesHandler);
  
  fastify.get('/leagues/:id', getLeagueHandler);
  
  fastify.patch('/leagues/:id', {
    preHandler: authenticate,
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute',
        keyGenerator: (request: FastifyRequest) => (request as any).user?.id || request.ip,
      },
    },
  }, updateLeagueHandler);
  
  fastify.delete('/leagues/:id', {
    preHandler: authenticate,
    config: {
      rateLimit: {
        max: 1,
        timeWindow: '1 day',
        keyGenerator: (request: FastifyRequest) => (request as any).user?.id || request.ip,
      },
    },
  }, deleteLeagueHandler);
  
  // User's leagues
  fastify.get('/users/me/leagues', { preHandler: authenticate }, getUserLeaguesHandler);
  
  // Join/Leave league
  fastify.post('/leagues/:id/join', { preHandler: authenticate }, joinLeagueHandler);
  fastify.post('/leagues/:id/leave', { preHandler: authenticate }, leaveLeagueHandler);
  
  // Invite links (join via token)
  fastify.get('/join/:token', getLeagueByInviteTokenHandler);
  fastify.post('/join/:token', { preHandler: authenticate }, joinViaInviteTokenHandler);
  
  // Commissioner: invite link management
  fastify.post('/leagues/:id/invite-links', { preHandler: authenticate }, createInviteLinkHandler);
  fastify.get('/leagues/:id/invite-links', { preHandler: authenticate }, getInviteLinksHandler);
  
  // League members
  fastify.get('/leagues/:id/members', getLeagueMembersHandler);
  fastify.delete('/leagues/:id/members/:memberId', { preHandler: authenticate }, removeMemberHandler);
  
  // Commissioner: join request management
  fastify.get('/leagues/:id/join-requests', { preHandler: authenticate }, getJoinRequestsHandler);
  fastify.patch('/leagues/:id/join-requests/:requestId', { preHandler: authenticate }, resolveJoinRequestHandler);
  
  // Commissioner: draft order
  fastify.patch('/leagues/:id/draft-order', { preHandler: authenticate }, updateDraftOrderHandler);
  
  // Commissioner: flag issue to admin
  fastify.post('/leagues/:id/flag', { preHandler: authenticate }, flagIssueHandler);
}
