import { FastifyRequest, FastifyReply } from 'fastify';
import { LeaguesService } from './leagues.service';
import { CreateLeagueInput, LeagueFilter, JoinLeagueInput, UpdateLeagueInput, UpdateDraftOrderInput, FlagIssueInput } from './types';

export class LeaguesController {
  constructor(private leaguesService: LeaguesService) {}

  /**
   * POST /api/v1/leagues - Create a new league
   */
  async createLeague(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const body = request.body as CreateLeagueInput;
      const league = await this.leaguesService.createLeague(user.id, body);
      return reply.status(201).send(league);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('League name') || 
            error.message.includes('Max players') ||
            error.message.includes('maximum of 10') ||
            error.message.includes('Season not found')) {
          return reply.status(400).send({ error: error.message });
        }
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Failed to create league' });
    }
  }

  /**
   * GET /api/v1/leagues - Get public leagues
   */
  async getPublicLeagues(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as { seasonId?: string; hasSpace?: string };
      const filters: LeagueFilter = {
        visibility: 'public',
        seasonId: query.seasonId,
        hasSpace: query.hasSpace === 'true',
      };

      const leagues = await this.leaguesService.getPublicLeagues(filters);
      return reply.send(leagues);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Failed to get leagues' });
    }
  }

  /**
   * GET /api/v1/leagues/:id - Get league by ID
   */
  async getLeague(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      const userId = user?.id;
      const params = request.params as { id: string };

      const league = await this.leaguesService.getLeagueById(params.id, userId);
      
      if (!league) {
        return reply.status(404).send({ error: 'League not found' });
      }

      // Check visibility - private leagues only visible to members
      if (league.visibility === 'private' && !user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      return reply.send(league);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Failed to get league' });
    }
  }

  /**
   * GET /api/v1/users/me/leagues - Get user's leagues
   */
  async getUserLeagues(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const leagues = await this.leaguesService.getUserLeagues(user.id);
      return reply.send(leagues);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Failed to get user leagues' });
    }
  }

  /**
   * POST /api/v1/leagues/:id/join - Join a league directly
   */
  async joinLeague(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const params = request.params as { id: string };
      const body = request.body as JoinLeagueInput;

      const result = await this.leaguesService.joinLeague(params.id, user.id, body);
      
      if (result.requiresApproval) {
        return reply.status(202).send({
          message: 'Join request submitted. Awaiting commissioner approval.',
          ...result,
        });
      }

      return reply.status(200).send({
        message: 'Successfully joined the league',
        ...result,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found') ||
            error.message.includes('already a member') ||
            error.message.includes('full') ||
            error.message.includes('maximum of 10') ||
            error.message.includes('Team name') ||
            error.message.includes('mid-season') ||
            error.message.includes('pending join request')) {
          return reply.status(400).send({ error: error.message });
        }
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Failed to join league' });
    }
  }

  /**
   * POST /api/v1/leagues/:id/leave - Leave a league
   */
  async leaveLeague(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const params = request.params as { id: string };
      await this.leaguesService.leaveLeague(params.id, user.id);
      
      return reply.status(200).send({ message: 'Successfully left the league' });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not a member') ||
            error.message.includes('Commissioner cannot leave')) {
          return reply.status(400).send({ error: error.message });
        }
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Failed to leave league' });
    }
  }

  /**
   * GET /api/v1/join/:token - Get league by invite token
   */
  async getLeagueByInviteToken(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as { token: string };
      const result = await this.leaguesService.getLeagueByInviteToken(params.token);
      
      return reply.send(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Invalid invite link')) {
          return reply.status(404).send({ error: error.message });
        }
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Failed to get league' });
    }
  }

  /**
   * POST /api/v1/join/:token - Join league via invite token
   */
  async joinViaInviteToken(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const params = request.params as { token: string };
      const body = request.body as JoinLeagueInput;

      const result = await this.leaguesService.joinViaInviteToken(params.token, user.id, body);
      
      if (result.requiresApproval) {
        return reply.status(202).send({
          message: 'Join request submitted. Awaiting commissioner approval.',
          ...result,
        });
      }

      return reply.status(200).send({
        message: 'Successfully joined the league',
        ...result,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Invalid invite link') ||
            error.message.includes('expired') ||
            error.message.includes('maximum uses') ||
            error.message.includes('already used') ||
            error.message.includes('already a member') ||
            error.message.includes('full') ||
            error.message.includes('maximum of 10') ||
            error.message.includes('Team name') ||
            error.message.includes('mid-season') ||
            error.message.includes('pending join request')) {
          return reply.status(400).send({ error: error.message });
        }
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Failed to join league' });
    }
  }

  /**
   * POST /api/v1/leagues/:id/invite-links - Create invite link
   */
  async createInviteLink(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const params = request.params as { id: string };
      const body = request.body as { maxUses?: number } | undefined;

      const inviteLink = await this.leaguesService.createInviteLink(
        params.id,
        user.id,
        body?.maxUses
      );
      
      return reply.status(201).send(inviteLink);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found') ||
            error.message.includes('Only the commissioner')) {
          return reply.status(403).send({ error: error.message });
        }
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Failed to create invite link' });
    }
  }

  /**
   * GET /api/v1/leagues/:id/invite-links - Get invite links
   */
  async getInviteLinks(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const params = request.params as { id: string };
      const inviteLinks = await this.leaguesService.getInviteLinks(params.id, user.id);
      
      return reply.send(inviteLinks);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Not a member') ||
            error.message.includes('Only the commissioner')) {
          return reply.status(403).send({ error: error.message });
        }
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Failed to get invite links' });
    }
  }

  /**
   * GET /api/v1/leagues/:id/members - Get league members
   */
  async getLeagueMembers(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as { id: string };
      const members = await this.leaguesService.getLeagueMembers(params.id);
      
      return reply.send(members);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Failed to get league members' });
    }
  }

  /**
   * DELETE /api/v1/leagues/:id/members/:memberId - Remove member
   */
  async removeMember(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const params = request.params as { id: string; memberId: string };
      await this.leaguesService.removeMember(params.id, params.memberId, user.id);
      
      return reply.status(200).send({ message: 'Member removed from league' });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found') ||
            error.message.includes('Only the commissioner') ||
            error.message.includes('Member not found') ||
            error.message.includes('Cannot remove the commissioner')) {
          return reply.status(400).send({ error: error.message });
        }
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Failed to remove member' });
    }
  }

  /**
   * GET /api/v1/leagues/:id/join-requests - Get join requests
   */
  async getJoinRequests(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const params = request.params as { id: string };
      const requests = await this.leaguesService.getJoinRequests(params.id, user.id);
      
      return reply.send(requests);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found') ||
            error.message.includes('Only the commissioner')) {
          return reply.status(403).send({ error: error.message });
        }
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Failed to get join requests' });
    }
  }

  /**
   * PATCH /api/v1/leagues/:id/join-requests/:requestId - Approve/reject join request
   */
  async resolveJoinRequest(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const params = request.params as { id: string; requestId: string };
      const body = request.body as { approve: boolean };

      const result = await this.leaguesService.resolveJoinRequest(
        params.id,
        params.requestId,
        user.id,
        body.approve
      );
      
      return reply.status(200).send(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found') ||
            error.message.includes('Only the commissioner') ||
            error.message.includes('Join request not found') ||
            error.message.includes('already resolved') ||
            error.message.includes('full') ||
            error.message.includes('maximum of 10')) {
          return reply.status(400).send({ error: error.message });
        }
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Failed to resolve join request' });
    }
  }

  /**
   * PATCH /api/v1/leagues/:id - Update league settings
   */
  async updateLeague(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const params = request.params as { id: string };
      const body = request.body as UpdateLeagueInput;

      const league = await this.leaguesService.updateLeague(params.id, user.id, body);
      return reply.send(league);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found') ||
            error.message.includes('Only the commissioner') ||
            error.message.includes('League name') ||
            error.message.includes('Max players') ||
            error.message.includes('Cannot reduce')) {
          return reply.status(400).send({ error: error.message });
        }
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Failed to update league' });
    }
  }

  /**
   * DELETE /api/v1/leagues/:id - Delete league
   */
  async deleteLeague(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const params = request.params as { id: string };
      await this.leaguesService.deleteLeague(params.id, user.id);
      
      return reply.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found') ||
            error.message.includes('Only the commissioner')) {
          return reply.status(403).send({ error: error.message });
        }
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Failed to delete league' });
    }
  }

  /**
   * PATCH /api/v1/leagues/:id/draft-order - Update draft order
   */
  async updateDraftOrder(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const params = request.params as { id: string };
      const body = request.body as UpdateDraftOrderInput;

      const members = await this.leaguesService.updateDraftOrder(params.id, user.id, body);
      return reply.send(members);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found') ||
            error.message.includes('Only the commissioner') ||
            error.message.includes('Draft order') ||
            error.message.includes('Invalid member') ||
            error.message.includes('Duplicate')) {
          return reply.status(400).send({ error: error.message });
        }
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Failed to update draft order' });
    }
  }

  /**
   * POST /api/v1/leagues/:id/flag - Flag issue to admin
   */
  async flagIssue(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const params = request.params as { id: string };
      const body = request.body as FlagIssueInput;

      const flag = await this.leaguesService.flagIssue(params.id, user.id, body);
      return reply.status(201).send(flag);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found') ||
            error.message.includes('Only the commissioner')) {
          return reply.status(403).send({ error: error.message });
        }
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Failed to flag issue' });
    }
  }
}
