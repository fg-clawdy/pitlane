/**
 * Drafts Controller
 * HTTP handlers for draft endpoints
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { DraftsService } from './drafts.service';

export class DraftsController {
  private draftsService: DraftsService;

  constructor(draftsService: DraftsService) {
    this.draftsService = draftsService;
  }

  /**
   * Get all draft windows for a league
   * GET /api/v1/leagues/:id/drafts
   */
  getLeagueDraftWindows = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const windows = await this.draftsService.getLeagueDraftWindows(id);
      return reply.send(windows);
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to get draft windows' });
    }
  };

  /**
   * Get current draft window for a league
   * GET /api/v1/leagues/:id/drafts/current
   */
  getCurrentDraftWindow = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const window = await this.draftsService.getCurrentDraftWindow(id);
      
      if (!window) {
        return reply.code(404).send({ error: 'No active draft window found' });
      }
      
      return reply.send(window);
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to get current draft window' });
    }
  };

  /**
   * Get draft window by ID
   * GET /api/v1/drafts/:draftId
   */
  getDraftWindow = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = request.params as { draftId: string };
      const window = await this.draftsService.getDraftWindow(draftId);
      
      if (!window) {
        return reply.code(404).send({ error: 'Draft window not found' });
      }
      
      return reply.send(window);
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to get draft window' });
    }
  };

  /**
   * Submit a draft pick
   * POST /api/v1/drafts/:draftId/picks
   */
  submitPick = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = request.params as { draftId: string };
      const { leagueMemberId, driverId } = request.body as { leagueMemberId: string; driverId: string };
      
      // Get user ID from auth
      const userId = (request as any).user?.userId;
      
      if (!userId) {
        return reply.code(401).send({ error: 'Not authenticated' });
      }

      const result = await this.draftsService.submitPick({
        draftWindowId: draftId,
        leagueMemberId,
        driverId,
        userId,
      });

      if (!result.success) {
        return reply.code(400).send({ error: result.error });
      }

      return reply.send(result.pick);
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to submit pick' });
    }
  };

  /**
   * Get draft state
   * GET /api/v1/drafts/:draftId/state
   */
  getDraftState = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = request.params as { draftId: string };
      const state = await this.draftsService.getDraftState(draftId);
      
      if (!state) {
        return reply.code(404).send({ error: 'Draft window not found' });
      }
      
      return reply.send(state);
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to get draft state' });
    }
  };

  /**
   * Open scheduled draft windows (admin/system)
   * POST /api/v1/admin/drafts/open-scheduled
   */
  openScheduledDraftWindows = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await this.draftsService.openScheduledDraftWindows();
      return reply.send(result);
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to open draft windows' });
    }
  };

  /**
   * Close expired draft windows (admin/system)
   * POST /api/v1/admin/drafts/close-expired
   */
  closeExpiredDraftWindows = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await this.draftsService.closeExpiredDraftWindows();
      return reply.send(result);
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to close draft windows' });
    }
  };

  /**
   * Create draft windows for a race (admin/system)
   * POST /api/v1/admin/drafts/create-for-race/:raceId
   */
  createDraftWindowsForRace = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { raceId } = request.params as { raceId: string };
      const result = await this.draftsService.createDraftWindowsForRace(raceId);
      return reply.send(result);
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to create draft windows' });
    }
  };

  /**
   * Resolve missed pick (admin/system)
   * POST /api/v1/admin/drafts/:draftId/resolve-missed/:leagueMemberId
   */
  resolveMissedPick = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId, leagueMemberId } = request.params as { draftId: string; leagueMemberId: string };
      const result = await this.draftsService.resolveMissedPick(draftId, leagueMemberId);
      
      if (!result.success) {
        return reply.code(400).send({ error: result.error });
      }
      
      return reply.send({ success: true });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to resolve missed pick' });
    }
  };
}

export default DraftsController;