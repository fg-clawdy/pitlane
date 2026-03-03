/**
 * Drafts Routes
 * Fastify routes for draft endpoints including WebSocket for live draft board
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DraftsController } from './drafts.controller';
import { sharedDraftsService } from './drafts.instance';
import { authenticate } from '../../lib/auth';

const draftsController = new DraftsController(sharedDraftsService);

// Handler functions (untyped to match leagues.routes.ts pattern)

async function getLeagueDraftWindowsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.getLeagueDraftWindows(request, reply);
}

async function getCurrentDraftWindowHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.getCurrentDraftWindow(request, reply);
}

async function getDraftWindowHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.getDraftWindow(request, reply);
}

async function getDraftStateHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.getDraftState(request, reply);
}

async function submitPickHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.submitPick(request, reply);
}

async function getAutoDraftPreferencesHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.getAutoDraftPreferences(request, reply);
}

async function setAutoDraftPreferencesHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.setAutoDraftPreferences(request, reply);
}

async function commissionerOverridePickHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.commissionerOverridePick(request, reply);
}

async function commissionerAssignMissedPickHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.commissionerAssignMissedPick(request, reply);
}

async function openScheduledDraftWindowsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.openScheduledDraftWindows(request, reply);
}

async function closeExpiredDraftWindowsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.closeExpiredDraftWindows(request, reply);
}

async function createDraftWindowsForRaceHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.createDraftWindowsForRace(request, reply);
}

async function resolveMissedPickHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.resolveMissedPick(request, reply);
}

async function processDriverSubstitutionHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.processDriverSubstitution(request, reply);
}

async function getActiveRedraftWindowsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.getActiveRedraftWindows(request, reply);
}

async function submitRedraftPickHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.submitRedraftPick(request, reply);
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

  // Auto-draft preference endpoints (require auth)
  fastify.get('/users/me/auto-draft-preferences', { preHandler: authenticate }, getAutoDraftPreferencesHandler);
  fastify.put('/users/me/auto-draft-preferences', { preHandler: authenticate }, setAutoDraftPreferencesHandler);

  // Commissioner override endpoints (commissioner only)
  fastify.patch('/drafts/:draftId/picks/:pickId/override', { preHandler: authenticate }, commissionerOverridePickHandler);
  fastify.post('/drafts/:draftId/assign-pick', { preHandler: authenticate }, commissionerAssignMissedPickHandler);

  // Admin endpoints for draft management
  fastify.post('/admin/drafts/open-scheduled', openScheduledDraftWindowsHandler);
  fastify.post('/admin/drafts/close-expired', closeExpiredDraftWindowsHandler);
  fastify.post('/admin/drafts/create-for-race/:raceId', createDraftWindowsForRaceHandler);
  fastify.post('/admin/drafts/:draftId/resolve-missed/:leagueMemberId', resolveMissedPickHandler);

  // Driver substitution endpoints (US-014)
  fastify.post('/admin/substitutions/:substitutionId/process', processDriverSubstitutionHandler);
  fastify.get('/users/me/redraft-windows', { preHandler: authenticate }, getActiveRedraftWindowsHandler);
  fastify.post('/substitutions/:substitutionId/redraft', { preHandler: authenticate }, submitRedraftPickHandler);
}

/**
 * Register WebSocket route for live draft board
 * Endpoint: /ws/leagues/:id/draft
 */
export async function draftWebSocketRoutes(fastify: FastifyInstance): Promise<void> {
  // WebSocket endpoint for live draft board
  fastify.get('/ws/leagues/:id/draft', { websocket: true }, async (connection: any, request: FastifyRequest) => {
    const leagueId = (request.params as { id: string }).id;
    
    console.log(`[WebSocket] Client connected for league ${leagueId}`);

    // Register this client for draft updates
    sharedDraftsService.registerWebSocketClient(leagueId, connection.socket);

    // Send initial draft state
    try {
      const draftWindow = await sharedDraftsService.getCurrentDraftWindow(leagueId);
      
      if (draftWindow) {
        connection.socket.send(JSON.stringify({
          type: 'draft_state_update',
          payload: draftWindow,
          timestamp: new Date(),
        }));
      } else {
        connection.socket.send(JSON.stringify({
          type: 'no_active_draft',
          payload: { leagueId },
          timestamp: new Date(),
        }));
      }
    } catch (error) {
      console.error('[WebSocket] Error getting draft state:', error);
      connection.socket.send(JSON.stringify({
        type: 'error',
        payload: { message: 'Failed to get draft state' },
        timestamp: new Date(),
      }));
    }

    // Handle incoming messages (for future use - e.g., keepalive, client requests)
    connection.socket.on('message', async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle different message types
        if (data.type === 'ping') {
          connection.socket.send(JSON.stringify({ type: 'pong', timestamp: new Date() }));
        } else if (data.type === 'get_state') {
          // Client requests fresh state
          const draftWindow = await sharedDraftsService.getCurrentDraftWindow(leagueId);
          if (draftWindow) {
            connection.socket.send(JSON.stringify({
              type: 'draft_state_update',
              payload: draftWindow,
              timestamp: new Date(),
            }));
          }
        }
      } catch (error) {
        console.error('[WebSocket] Error handling message:', error);
      }
    });

    // Handle disconnect
    connection.socket.on('close', () => {
      console.log(`[WebSocket] Client disconnected from league ${leagueId}`);
      sharedDraftsService.unregisterWebSocketClient(leagueId, connection.socket);
    });

    // Handle errors
    connection.socket.on('error', (error: Error) => {
      console.error(`[WebSocket] Error for league ${leagueId}:`, error);
      sharedDraftsService.unregisterWebSocketClient(leagueId, connection.socket);
    });
  });
}