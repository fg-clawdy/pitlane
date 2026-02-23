import { FastifyRequest, FastifyReply } from 'fastify';
import { LeaguesService } from './leagues.service';
import { CreateLeagueInput, LeagueFilter } from './types';

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
}