/**
 * Drafts Routes
 * Fastify routes for draft endpoints including WebSocket for live draft board
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DraftsController } from './drafts.controller';
import { sharedDraftsService } from './drafts.instance';
import { authenticate } from '../../lib/auth';

const draftsController = new DraftsController(sharedDraftsService);

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
 * GET /api/v1/users/me/auto-draft-preferences
 * Get user's auto-draft preferences
 */
async function getAutoDraftPreferencesHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.getAutoDraftPreferences(request, reply);
}

/**
 * PUT /api/v1/users/me/auto-draft-preferences
 * Set user's auto-draft preferences
 */
async function setAutoDraftPreferencesHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.setAutoDraftPreferences(request, reply);
}

/**
 * PATCH /api/v1/drafts/:draftId/picks/:pickId/override
 * Commissioner override a draft pick
 */
async function commissionerOverridePickHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.commissionerOverridePick(request, reply);
}

/**
 * POST /api/v1/drafts/:draftId/assign-pick
 * Commissioner assign a pick to member who missed
 */
async function commissionerAssignPickHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.commissionerAssignPick(request, reply);
}

/**
 * POST /api/v1/admin/substitutions/:substitutionId/process
 * Process a driver substitution
 */
async function processDriverSubstitutionHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.processDriverSubstitution(request, reply);
}

/**
 * GET /api/v1/users/me/redraft-windows
 * Get active redraft windows for current user
 */
async function getActiveRedraftWindowsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.getActiveRedraftWindows(request, reply);
}

/**
 * POST /api/v1/substitutions/:substitutionId/redraft
 * Submit a redraft pick
 */
async function submitRedraftPickHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.submitRedraftPick(request, reply);
}

/**
 * GET /api/v1/drafts/:draftId/substitutions/:substitutionId/impact
 * Get substitution impact for a draft window
 */
async function getSubstitutionImpactHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await draftsController.getSubstitutionImpact(request, reply);
}

/**
 * Register draft routes
 */
export async function draftsRoutes(fastify: FastifyInstance): Promise<void> {
  // League draft endpoints (require auth)
  fastify.get('/leagues/:id/drafts', {
    preHandler: authenticate,
    config: {
      rateLimit: {
        max: 60,
        timeWindow: '1 minute',
        keyGenerator: (request: FastifyRequest) => (request as any).user?.userId || request.ip,
      },
    },
  }, getLeagueDraftWindowsHandler);

  fastify.get('/leagues/:id/drafts/current', {
    preHandler: authenticate,
    config: {
      rateLimit: {
        max: 60,
        timeWindow: '1 minute',
        keyGenerator: (request: FastifyRequest) => (request as any).user?.userId || request.ip,
      },
    },
  }, getCurrentDraftWindowHandler);

  // Draft window endpoints (require auth)
  fastify.get('/drafts/:draftId', {
    preHandler: authenticate,
    config: {
      rateLimit: {
        max: 60,
        timeWindow: '1 minute',
        keyGenerator: (request: FastifyRequest) => (request as any).user?.userId || request.ip,
      },
    },
  }, getDraftWindowHandler);

  fastify.get('/drafts/:draftId/state', {
    preHandler: authenticate,
    config: {
      rateLimit: {
        max: 60,
        timeWindow: '1 minute',
        keyGenerator: (request: FastifyRequest) => (request as any).user?.userId || request.ip,
      },
    },
  }, getDraftStateHandler);

  fastify.post('/drafts/:draftId/picks', {
    preHandler: authenticate,
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 minute',
        keyGenerator: (request: FastifyRequest) => (request as any).user?.userId || request.ip,
      },
    },
  }, submitPickHandler);

  // Auto-draft preference endpoints (require auth)
  fastify.get('/users/me/auto-draft-preferences', {
    preHandler: authenticate,
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 minute',
        keyGenerator: (request: FastifyRequest) => (request as any).user?.userId || request.ip,
      },
    },
  }, getAutoDraftPreferencesHandler);

  fastify.put('/users/me/auto-draft-preferences', {
    preHandler: authenticate,
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
        keyGenerator: (request: FastifyRequest) => (request as any).user?.userId || request.ip,
      },
    },
  }, setAutoDraftPreferencesHandler);

  // Commissioner override endpoints (commissioner only)
  fastify.patch('/drafts/:draftId/picks/:pickId/override', {
    preHandler: authenticate,
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
        keyGenerator: (request: FastifyRequest) => (request as any).user?.userId || request.ip,
      },
    },
  }, commissionerOverridePickHandler);

  fastify.post('/drafts/:draftId/assign-pick', {
    preHandler: authenticate,
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
        keyGenerator: (request: FastifyRequest) => (request as any).user?.userId || request.ip,
      },
    },
  }, commissionerAssignPickHandler);

  // Admin endpoints for draft management
  fastify.post('/admin/drafts/open-scheduled', openScheduledDraftWindowsHandler);
  fastify.post('/admin/drafts/close-expired', closeExpiredDraftWindowsHandler);
  fastify.post('/admin/drafts/create-for-race/:raceId', createDraftWindowsForRaceHandler);
  fastify.post('/admin/drafts/:draftId/resolve-missed/:leagueMemberId', resolveMissedPickHandler);

  // Driver substitution endpoints (US-014)
  // Admin: Process a driver substitution after confirmation
  fastify.post('/admin/substitutions/:substitutionId/process', processDriverSubstitutionHandler);

  // User: Get active redraft windows
  fastify.get('/users/me/redraft-windows', {
    preHandler: authenticate,
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 minute',
        keyGenerator: (request: FastifyRequest) => (request as any).user?.userId || request.ip,
      },
    },
  }, getActiveRedraftWindowsHandler);

  // User: Submit a redraft pick (after driver substitution)
  fastify.post('/substitutions/:substitutionId/redraft', {
    preHandler: authenticate,
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
        keyGenerator: (request: FastifyRequest) => (request as any).user?.userId || request.ip,
      },
    },
  }, submitRedraftPickHandler);

  // User: Get substitution impact for a draft window
  fastify.get('/drafts/:draftId/substitutions/:substitutionId/impact', {
    preHandler: authenticate,
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 minute',
        keyGenerator: (request: FastifyRequest) => (request as any).user?.userId || request.ip,
      },
    },
  }, getSubstitutionImpactHandler);
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