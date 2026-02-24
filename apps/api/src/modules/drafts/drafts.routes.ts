/**
 * Drafts Routes
 * Fastify routes for draft endpoints
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DraftsController } from './drafts.controller';
import { DraftsService } from './drafts.service';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../../lib/auth';

const prisma = new PrismaClient();
const draftsService = new DraftsService(prisma);
const draftsController = new DraftsController(draftsService);

/**
 * GET /api/v1/leagues/:id/drafts
 * Get all draft windows for a league
 */
async function getLeagueDraftWindowsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.getLeagueDraftWindows(request, reply);
}

/**
 * GET /api/v1/leagues/:id/drafts/current
 * Get current draft window for a league
 */
async function getCurrentDraftWindowHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.getCurrentDraftWindow(request, reply);
}

/**
 * GET /api/v1/drafts/:draftId
 * Get draft window by ID
 */
async function getDraftWindowHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.getDraftWindow(request, reply);
}

/**
 * GET /api/v1/drafts/:draftId/state
 * Get draft state
 */
async function getDraftStateHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.getDraftState(request, reply);
}

/**
 * POST /api/v1/drafts/:draftId/picks
 * Submit a draft pick
 */
async function submitPickHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.submitPick(request, reply);
}

/**
 * POST /api/v1/admin/drafts/open-scheduled
 * Open scheduled draft windows
 */
async function openScheduledDraftWindowsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.openScheduledDraftWindows(request, reply);
}

/**
 * POST /api/v1/admin/drafts/close-expired
 * Close expired draft windows
 */
async function closeExpiredDraftWindowsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.closeExpiredDraftWindows(request, reply);
}

/**
 * POST /api/v1/admin/drafts/create-for-race/:raceId
 * Create draft windows for a race
 */
async function createDraftWindowsForRaceHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.createDraftWindowsForRace(request, reply);
}

/**
 * POST /api/v1/admin/drafts/:draftId/resolve-missed/:leagueMemberId
 * Resolve a missed pick
 */
async function resolveMissedPickHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.resolveMissedPick(request, reply);
}

/**
 * Register draft routes
 */
export async function draftsRoutes(fastify: FastifyInstance): Promise<void> {
  // League draft endpoints (require auth)
  fastify.get('/leagues/:id/drafts', { preHandler: authenticate }, getLeagueDraftWindowsHandler);
  fastify.get('/leagues/:id/drafts/current', { preHandler: authenticate }, getCurrentDraftWindowHandler);

  // Draft window endpoints (require auth)
  fastify.get('/drafts/:draftId', { preHandler: authenticate }, getDraftWindowHandler);
  fastify.get('/drafts/:draftId/state', { preHandler: authenticate }, getDraftStateHandler);
  fastify.post('/drafts/:draftId/picks', { preHandler: authenticate }, submitPickHandler);

  // Admin endpoints for draft management
  fastify.post('/admin/drafts/open-scheduled', openScheduledDraftWindowsHandler);
  fastify.post('/admin/drafts/close-expired', closeExpiredDraftWindowsHandler);
  fastify.post('/admin/drafts/create-for-race/:raceId', createDraftWindowsForRaceHandler);
  fastify.post('/admin/drafts/:draftId/resolve-missed/:leagueMemberId', resolveMissedPickHandler);
}