/**
 * Leagues Controller
 * Handles league management endpoints
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { LeaguesService } from './leagues.service';
import { CreateLeagueInput, LeagueFilter, JoinLeagueInput, UpdateLeagueInput, UpdateDraftOrderInput, FlagIssueInput } from './types';
import { 
  createLeagueSchema, 
  joinLeagueSchema, 
  updateLeagueSchema, 
  updateDraftOrderSchema, 
  flagIssueSchema 
} from './leagues.dto';
import { ApiError, sendSuccess, sendError, getAuthenticatedUser, getOptionalUser } from '../../lib/api-response';
import { auditAction } from '../../lib/audit';

export class LeaguesController {
  constructor(private leaguesService: LeaguesService) {}

  /**
   * POST /api/v1/leagues - Create a new league
   */
  async createLeague(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const user = getAuthenticatedUser(request);

      // Validate input
      const input = createLeagueSchema.parse(request.body);
      const league = await this.leaguesService.createLeague(user.id, input);
      
      // Audit log
      await auditAction(request, 'CREATE_LEAGUE', 'League', league.id);
      
      sendSuccess(reply, league, 201);
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
   * GET /api/v1/leagues - Get public leagues
   */
  async getPublicLeagues(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as { seasonId?: string; hasSpace?: string };
      const filters: LeagueFilter = {
        visibility: 'public',
        seasonId: query.seasonId,
        hasSpace: query.hasSpace === 'true',
      };

      const leagues = await this.leaguesService.getPublicLeagues(filters);
      sendSuccess(reply, leagues);
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  }

  /**
   * GET /api/v1/leagues/:id - Get league by ID
   */
  async getLeague(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const user = getOptionalUser(request);
      const userId = user?.id;
      const params = request.params as { id: string };

      const league = await this.leaguesService.getLeagueById(params.id, userId);

      if (!league) {
        throw ApiError.notFound('League');
      }

      // Check visibility - private leagues only visible to members
      if (league.visibility === 'private' && !user) {
        throw ApiError.unauthorized();
      }

      sendSuccess(reply, league);
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  }

  /**
   * GET /api/v1/users/me/leagues - Get user's leagues
   */
  async getUserLeagues(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const user = getAuthenticatedUser(request);

      const leagues = await this.leaguesService.getUserLeagues(user.id);
      sendSuccess(reply, leagues);
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  }

  /**
   * POST /api/v1/leagues/:id/join - Join a league directly
   */
  async joinLeague(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const user = getAuthenticatedUser(request);

      const params = request.params as { id: string };
      
      // Validate input
      if (!params.id || params.id.length === 0) {
        throw ApiError.badRequest('League ID is required');
      }
      
      const input = joinLeagueSchema.parse(request.body);

      const result = await this.leaguesService.joinLeague(params.id, user.id, input);

      // Audit log
      await auditAction(request, 'JOIN_LEAGUE', 'League', params.id, { teamName: input.teamName });

      if (result.requiresApproval) {
        sendSuccess(reply, {
          message: 'Join request submitted. Awaiting commissioner approval.',
          ...result,
        }, 202);
      } else {
        sendSuccess(reply, {
          message: 'Successfully joined the league',
          ...result,
        });
      }
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
   * POST /api/v1/leagues/:id/leave - Leave a league
   */
  async leaveLeague(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const user = getAuthenticatedUser(request);

      const params = request.params as { id: string };
      await this.leaguesService.leaveLeague(params.id, user.id);

      sendSuccess(reply, { message: 'Successfully left the league' });
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  }

  /**
   * GET /api/v1/join/:token - Get league by invite token
   */
  async getLeagueByInviteToken(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { token: string };
      const result = await this.leaguesService.getLeagueByInviteToken(params.token);

      sendSuccess(reply, result);
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  }

  /**
   * POST /api/v1/join/:token - Join league via invite token
   */
  async joinViaInviteToken(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const user = getAuthenticatedUser(request);

      const params = request.params as { token: string };
      const body = request.body as JoinLeagueInput;

      const result = await this.leaguesService.joinViaInviteToken(params.token, user.id, body);

      if (result.requiresApproval) {
        sendSuccess(reply, {
          message: 'Join request submitted. Awaiting commissioner approval.',
          ...result,
        }, 202);
      } else {
        sendSuccess(reply, {
          message: 'Successfully joined the league',
          ...result,
        });
      }
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  }

  /**
   * POST /api/v1/leagues/:id/invite-links - Create invite link
   */
  async createInviteLink(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const user = getAuthenticatedUser(request);

      const params = request.params as { id: string };
      const body = request.body as { maxUses?: number } | undefined;

      const inviteLink = await this.leaguesService.createInviteLink(
        params.id,
        user.id,
        body?.maxUses
      );

      sendSuccess(reply, inviteLink, 201);
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  }

  /**
   * GET /api/v1/leagues/:id/invite-links - Get invite links
   */
  async getInviteLinks(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const user = getAuthenticatedUser(request);

      const params = request.params as { id: string };
      const inviteLinks = await this.leaguesService.getInviteLinks(params.id, user.id);

      sendSuccess(reply, inviteLinks);
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  }

  /**
   * GET /api/v1/leagues/:id/members - Get league members
   */
  async getLeagueMembers(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { id: string };
      const members = await this.leaguesService.getLeagueMembers(params.id);

      sendSuccess(reply, members);
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  }

  /**
   * DELETE /api/v1/leagues/:id/members/:memberId - Remove member
   */
  async removeMember(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const user = getAuthenticatedUser(request);

      const params = request.params as { id: string; memberId: string };
      await this.leaguesService.removeMember(params.id, params.memberId, user.id);

      await auditAction(request, 'REMOVE_MEMBER', 'LeagueMember', params.memberId);
      sendSuccess(reply, { message: 'Member removed from league' });
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  }

  /**
   * GET /api/v1/leagues/:id/join-requests - Get join requests
   */
  async getJoinRequests(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const user = getAuthenticatedUser(request);

      const params = request.params as { id: string };
      const requests = await this.leaguesService.getJoinRequests(params.id, user.id);

      sendSuccess(reply, requests);
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  }

  /**
   * PATCH /api/v1/leagues/:id/join-requests/:requestId - Approve/reject join request
   */
  async resolveJoinRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const user = getAuthenticatedUser(request);

      const params = request.params as { id: string; requestId: string };
      const body = request.body as { approve: boolean };

      const result = await this.leaguesService.resolveJoinRequest(
        params.id,
        params.requestId,
        user.id,
        body.approve
      );

      await auditAction(request, body.approve ? 'APPROVE_JOIN_REQUEST' : 'REJECT_JOIN_REQUEST', 'JoinRequest', params.requestId);
      sendSuccess(reply, result);
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  }

  /**
   * PATCH /api/v1/leagues/:id - Update league settings
   */
  async updateLeague(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const user = getAuthenticatedUser(request);

      const params = request.params as { id: string };
      const body = updateLeagueSchema.parse(request.body);

      const league = await this.leaguesService.updateLeague(params.id, user.id, body);
      
      await auditAction(request, 'UPDATE_LEAGUE', 'League', params.id);
      sendSuccess(reply, league);
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
   * DELETE /api/v1/leagues/:id - Delete league
   */
  async deleteLeague(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const user = getAuthenticatedUser(request);

      const params = request.params as { id: string };
      await this.leaguesService.deleteLeague(params.id, user.id);

      await auditAction(request, 'DELETE_LEAGUE', 'League', params.id);
      reply.code(204).send();
    } catch (error) {
      request.log.error(error);
      sendError(reply, error);
    }
  }

  /**
   * PATCH /api/v1/leagues/:id/draft-order - Update draft order (commissioner only)
   */
  async updateDraftOrder(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const user = getAuthenticatedUser(request);

      const params = request.params as { id: string };
      
      // Validate input
      if (!params.id || params.id.length === 0) {
        throw ApiError.badRequest('League ID is required');
      }
      
      const input = updateDraftOrderSchema.parse(request.body);

      const members = await this.leaguesService.updateDraftOrder(params.id, user.id, input);
      
      // Audit log
      await auditAction(request, 'UPDATE_DRAFT_ORDER', 'League', params.id);
      
      sendSuccess(reply, members);
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
   * POST /api/v1/leagues/:id/flag - Flag issue to admin
   */
  async flagIssue(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const user = getAuthenticatedUser(request);

      const params = request.params as { id: string };
      
      // Validate input
      if (!params.id || params.id.length === 0) {
        throw ApiError.badRequest('League ID is required');
      }
      
      const input = flagIssueSchema.parse(request.body);

      const flag = await this.leaguesService.flagIssue(params.id, user.id, input);
      
      // Audit log
      await auditAction(request, 'FLAG_ISSUE', 'CommissionerFlag', flag.id);
      
      sendSuccess(reply, flag, 201);
    } catch (error) {
      request.log.error(error);
      if (error instanceof z.ZodError) {
        sendError(reply, ApiError.validationError(error.errors));
      } else {
        sendError(reply, error);
      }
    }
  }
}