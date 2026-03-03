/**
 * Drafts Controller
 * Handles draft-related HTTP endpoints
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import DraftsService from './drafts.service';
import { 
  submitPickSchema, 
  setAutoDraftPreferencesSchema,
  draftIdParamSchema,
  leagueDraftsParamSchema,
} from './drafts.dto';
import { ApiError, ErrorCode, sendSuccess, sendError, getAuthenticatedUser, getOptionalUser } from '../../lib/api-response';
import { auditAction } from '../../lib/audit';

const prisma = new PrismaClient();

export class DraftsController {
  private draftsService: DraftsService;

  constructor(draftsService?: DraftsService) {
    this.draftsService = draftsService || new DraftsService(prisma);
  }

  /**
   * Get current draft window for a league
   * GET /api/v1/leagues/:id/drafts/current
   */
  getCurrentDraftWindow = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const { id: leagueId } = request.params as { id: string };

      const draftWindow = await this.draftsService.getCurrentDraftWindow(leagueId);

      sendSuccess(reply, draftWindow);
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  };

  /**
   * Get all draft windows for a league
   * GET /api/v1/leagues/:id/drafts
   */
  getLeagueDraftWindows = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const { id: leagueId } = request.params as { id: string };

      const windows = await this.draftsService.getLeagueDraftWindows(leagueId);

      sendSuccess(reply, windows);
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  };

  /**
   * Get draft state for a draft window
   * GET /api/v1/drafts/:draftId/state
   */
  getDraftState = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const { draftId } = request.params as { draftId: string };

      const state = await this.draftsService.getDraftState(draftId);

      if (!state) {
        throw ApiError.notFound('Draft window');
      }

      sendSuccess(reply, state);
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  };

  /**
   * Get draft window by ID
   * GET /api/v1/drafts/:draftId
   */
  getDraftWindow = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const { draftId } = request.params as { draftId: string };

      const window = await this.draftsService.getDraftWindow(draftId);

      if (!window) {
        throw ApiError.notFound('Draft window');
      }

      sendSuccess(reply, window);
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  };

  /**
   * Submit a draft pick
   * POST /api/v1/drafts/:draftId/picks
   */
  submitPick = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const user = getAuthenticatedUser(request);
      const { draftId } = request.params as { draftId: string };
      
      // Validate input
      if (!draftId) {
        throw ApiError.badRequest('Draft ID is required');
      }
      
      const input = submitPickSchema.parse(request.body);

      // Ensure draftWindowId from params matches request body if provided
      const pickInput = {
        draftWindowId: draftId,
        leagueMemberId: input.leagueMemberId,
        driverId: input.driverId,
        userId: user.id,
      };

      const result = await this.draftsService.submitPick(pickInput);

      if (!result.success) {
        throw ApiError.badRequest(result.error || 'Failed to submit pick');
      }

      // Audit log
      await auditAction(request, 'SUBMIT_DRAFT_PICK', 'DraftPick', result.pick?.id || '');

      sendSuccess(reply, result.pick);
    } catch (error) {
      request.log.error(error);
      if (error instanceof z.ZodError) {
        sendError(reply, ApiError.validationError(error.errors));
      } else {
        sendError(reply, error);
      }
    }
  };

  /**
   * Validate a pick before submitting
   * POST /api/v1/drafts/:draftId/validate-pick
   */
  validatePick = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const params = draftIdParamSchema.parse(request.params);
      const input = submitPickSchema.parse(request.body);

      const validation = await this.draftsService.validatePick(params.draftId, input.leagueMemberId, input.driverId);

      sendSuccess(reply, validation);
    } catch (error) {
      request.log.error(error);
      if (error instanceof z.ZodError) {
        sendError(reply, ApiError.validationError(error.errors));
      } else {
        sendError(reply, error);
      }
    }
  };

  /**
   * Get auto-draft preferences for current user
   * GET /api/v1/users/me/auto-draft-preferences
   */
  getAutoDraftPreferences = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const user = getAuthenticatedUser(request);

      const preferences = await this.draftsService.getAutoDraftPreferences(user.id);

      sendSuccess(reply, preferences);
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  };

  /**
   * Set auto-draft preferences for current user
   * PUT /api/v1/users/me/auto-draft-preferences
   */
  setAutoDraftPreferences = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const user = getAuthenticatedUser(request);
      const input = setAutoDraftPreferencesSchema.parse(request.body);

      const result = await this.draftsService.setAutoDraftPreferences(user.id, input);

      await auditAction(request, 'SET_AUTO_DRAFT_PREFERENCES', 'AutoDraftPrefs', user.id);
      sendSuccess(reply, result);
    } catch (error) {
      request.log.error(error);
      if (error instanceof z.ZodError) {
        sendError(reply, ApiError.validationError(error.errors));
      } else {
        sendError(reply, error);
      }
    }
  };

  /**
   * Get active redraft windows for current user
   * GET /api/v1/users/me/redraft-windows
   */
  getActiveRedraftWindows = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const user = getAuthenticatedUser(request);

      const redrafts = await this.draftsService.getActiveRedraftWindows(user.id);

      sendSuccess(reply, redrafts);
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  };

  /**
   * Submit a redraft pick
   * POST /api/v1/substitutions/:substitutionId/redraft
   */
  submitRedraftPick = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const user = getAuthenticatedUser(request);
      const { substitutionId } = request.params as { substitutionId: string };
      const { leagueMemberId, newDriverId } = request.body as { leagueMemberId: string; newDriverId: string };

      if (!leagueMemberId || !newDriverId) {
        throw ApiError.badRequest('leagueMemberId and newDriverId are required');
      }

      const result = await this.draftsService.submitRedraftPick(
        substitutionId,
        leagueMemberId,
        newDriverId,
        user.id
      );

      if (!result.success) {
        throw ApiError.badRequest(result.error || 'Failed to submit redraft');
      }

      sendSuccess(reply, { message: 'Redraft submitted successfully' });
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  };

  /**
   * Commissioner: Override a draft pick
   * PATCH /api/v1/drafts/:draftId/picks/:pickId/override
   */
  commissionerOverridePick = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const user = getAuthenticatedUser(request);
      const { draftId, pickId } = request.params as { draftId: string; pickId: string };
      const { newDriverId } = request.body as { newDriverId: string };

      if (!newDriverId) {
        throw ApiError.badRequest('newDriverId is required');
      }

      const result = await this.draftsService.commissionerOverridePick(
        draftId,
        pickId,
        newDriverId,
        user.id
      );

      if (!result.success) {
        throw ApiError.badRequest(result.error || 'Failed to override pick');
      }

      sendSuccess(reply, result.pick);
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  };

  /**
   * Commissioner: Assign a missed pick
   * POST /api/v1/drafts/:draftId/assign-pick
   */
  commissionerAssignMissedPick = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const user = getAuthenticatedUser(request);
      const { draftId } = request.params as { draftId: string };
      const { leagueMemberId, round, driverId } = request.body as { leagueMemberId: string; round: number; driverId: string };

      if (!leagueMemberId || !round || !driverId) {
        throw ApiError.badRequest('leagueMemberId, round, and driverId are required');
      }

      const result = await this.draftsService.commissionerAssignMissedPick(
        draftId,
        leagueMemberId,
        round,
        driverId,
        user.id
      );

      if (!result.success) {
        throw ApiError.badRequest(result.error || 'Failed to assign missed pick');
      }

      sendSuccess(reply, result.pick);
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  };

  /**
   * Admin: Resolve missed pick
   * POST /api/v1/admin/drafts/:draftId/resolve-missed/:leagueMemberId
   */
  resolveMissedPick = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const { draftId, leagueMemberId } = request.params as { draftId: string; leagueMemberId: string };

      if (!leagueMemberId) {
        throw ApiError.badRequest('leagueMemberId is required');
      }

      const result = await this.draftsService.resolveMissedPick(draftId, leagueMemberId);

      if (!result.success) {
        throw ApiError.badRequest(result.error || 'Failed to resolve missed pick');
      }

      sendSuccess(reply, { message: 'Missed pick resolved successfully' });
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  };

  /**
   * Admin: Create draft windows for a race
   * POST /api/v1/admin/drafts/create-for-race/:raceId
   */
  createDraftWindowsForRace = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const { raceId } = request.params as { raceId: string };

      const result = await this.draftsService.createDraftWindowsForRace(raceId);

      if (result.errors.length > 0) {
        request.log.error({ errors: result.errors }, 'Errors creating draft windows');
      }

      sendSuccess(reply, result);
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  };

  /**
   * Admin: Process driver substitution
   * POST /api/v1/admin/substitutions/:substitutionId/process
   */
  processDriverSubstitution = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const { substitutionId } = request.params as { substitutionId: string };

      const result = await this.draftsService.processDriverSubstitution(substitutionId);

      if (!result.success) {
        throw ApiError.badRequest(result.error || 'Failed to process substitution');
      }

      sendSuccess(reply, result);
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  };

  /**
   * Admin: Open scheduled draft windows
   * POST /api/v1/admin/drafts/open-scheduled
   */
  openScheduledDraftWindows = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const result = await this.draftsService.openScheduledDraftWindows();
      sendSuccess(reply, result);
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  };

  /**
   * Admin: Close expired draft windows
   * POST /api/v1/admin/drafts/close-expired
   */
  closeExpiredDraftWindows = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const result = await this.draftsService.closeExpiredDraftWindows();
      sendSuccess(reply, result);
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  };

}

export default DraftsController;
