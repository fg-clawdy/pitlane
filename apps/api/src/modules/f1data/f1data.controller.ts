/**
 * F1 Data Controller
 * Handles HTTP requests for F1 data endpoints
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { F1DataService } from './f1data.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const f1dataService = new F1DataService(prisma);

/**
 * Get all seasons
 * GET /api/v1/seasons
 */
export async function getSeasons(_request: FastifyRequest, reply: FastifyReply) {
  try {
    const seasons = await f1dataService.getSeasons();
    return reply.send({
      success: true,
      data: seasons
    });
  } catch (error) {
    console.error('Error fetching seasons:', error);
    return reply.code(500).send({
      success: false,
      message: 'Failed to fetch seasons'
    });
  }
}

/**
 * Get races for a season
 * GET /api/v1/seasons/:year/races
 */
export async function getRacesBySeason(
  request: FastifyRequest<{ Params: { year: string } }>,
  reply: FastifyReply
) {
  try {
    const year = parseInt(request.params.year, 10);
    if (isNaN(year)) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid year parameter'
      });
    }

    const races = await f1dataService.getRaces(year);
    return reply.send({
      success: true,
      data: races
    });
  } catch (error) {
    console.error('Error fetching races:', error);
    return reply.code(500).send({
      success: false,
      message: 'Failed to fetch races'
    });
  }
}

/**
 * Get a specific race
 * GET /api/v1/seasons/:year/races/:round
 */
export async function getRace(
  request: FastifyRequest<{ Params: { year: string; round: string } }>,
  reply: FastifyReply
) {
  try {
    const year = parseInt(request.params.year, 10);
    const round = parseInt(request.params.round, 10);

    if (isNaN(year) || isNaN(round)) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid year or round parameter'
      });
    }

    const race = await f1dataService.getRace(year, round);
    
    if (!race) {
      return reply.code(404).send({
        success: false,
        message: 'Race not found'
      });
    }

    return reply.send({
      success: true,
      data: race
    });
  } catch (error) {
    console.error('Error fetching race:', error);
    return reply.code(500).send({
      success: false,
      message: 'Failed to fetch race'
    });
  }
}

/**
 * Get drivers for a season
 * GET /api/v1/seasons/:year/drivers
 */
export async function getDriversBySeason(
  request: FastifyRequest<{ Params: { year: string } }>,
  reply: FastifyReply
) {
  try {
    const year = parseInt(request.params.year, 10);
    if (isNaN(year)) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid year parameter'
      });
    }

    const drivers = await f1dataService.getDrivers(year);
    return reply.send({
      success: true,
      data: drivers
    });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return reply.code(500).send({
      success: false,
      message: 'Failed to fetch drivers'
    });
  }
}

/**
 * Sync current season (admin only - for now, open)
 * POST /api/v1/admin/sync
 */
export async function syncCurrentSeason(_request: FastifyRequest, reply: FastifyReply) {
  try {
    const result = await f1dataService.syncCurrentSeason();
    
    if (result.errors.length > 0) {
      return reply.code(207).send({
        success: true,
        data: result,
        warnings: result.errors
      });
    }

    return reply.send({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error syncing season:', error);
    return reply.code(500).send({
      success: false,
      message: 'Failed to sync season'
    });
  }
}

/**
 * Get race results for a specific race
 * GET /api/v1/seasons/:year/races/:round/results
 */
export async function getRaceResults(
  request: FastifyRequest<{ Params: { year: string; round: string } }>,
  reply: FastifyReply
) {
  try {
    const year = parseInt(request.params.year, 10);
    const round = parseInt(request.params.round, 10);

    if (isNaN(year) || isNaN(round)) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid year or round parameter'
      });
    }

    const results = await f1dataService.getRaceResults(year, round);
    
    return reply.send({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error fetching race results:', error);
    return reply.code(500).send({
      success: false,
      message: 'Failed to fetch race results'
    });
  }
}

/**
 * Sync race results for a specific race (admin)
 * POST /api/v1/admin/sync-results/:year/:round
 */
export async function syncRaceResults(
  request: FastifyRequest<{ Params: { year: string; round: string } }>,
  reply: FastifyReply
) {
  try {
    const year = parseInt(request.params.year, 10);
    const round = parseInt(request.params.round, 10);

    if (isNaN(year) || isNaN(round)) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid year or round parameter'
      });
    }

    const result = await f1dataService.pollRaceResults(year, round, 1);
    
    if (result.errors.length > 0) {
      return reply.code(207).send({
        success: true,
        data: {
          resultsSynced: result.resultsSynced,
          raceId: result.raceId,
          discrepancies: result.discrepancies
        },
        warnings: result.errors
      });
    }

    return reply.send({
      success: true,
      data: {
        resultsSynced: result.resultsSynced,
        raceId: result.raceId,
        discrepancies: result.discrepancies
      }
    });
  } catch (error) {
    console.error('Error syncing race results:', error);
    return reply.code(500).send({
      success: false,
      message: 'Failed to sync race results'
    });
  }
}
