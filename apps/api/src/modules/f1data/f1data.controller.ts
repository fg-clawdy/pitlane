/**
 * F1 Data Controller
 * Handles HTTP requests for F1 data endpoints
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { F1DataService } from './f1data.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const f1dataService = new F1DataService(prisma);

// DTOs for admin data override
interface OverrideRaceResultBody {
  field: string;
  adminValue: any;
  adminProtected?: boolean;
}

interface DriverSubstitutionBody {
  originalDriverId: string;
  replacementDriverId: string | null;
  reason: string;
}

interface ResolveDiscrepancyParams {
  discrepancyId: string;
}

interface ResolveDiscrepancyBody {
  resolution: 'accepted' | 'rejected';
}

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
 * Get teams (constructors) for a season
 * GET /api/v1/seasons/:year/teams
 */
export async function getTeamsBySeason(
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

    const teams = await f1dataService.getTeams(year);
    return reply.send({
      success: true,
      data: teams
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return reply.code(500).send({
      success: false,
      message: 'Failed to fetch teams'
    });
  }
}

/**
 * Get all teams (constructors)
 * GET /api/v1/teams
 */
export async function getAllTeams(_request: FastifyRequest, reply: FastifyReply) {
  try {
    const teams = await f1dataService.getAllTeams();
    return reply.send({
      success: true,
      data: teams
    });
  } catch (error) {
    console.error('Error fetching all teams:', error);
    return reply.code(500).send({
      success: false,
      message: 'Failed to fetch teams'
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

// ========== ADMIN DATA OVERRIDE ENDPOINTS ==========

/**
 * Override a race result field
 * PATCH /api/v1/admin/race-results/:resultId/override
 */
export async function overrideRaceResult(
  request: FastifyRequest<{ Params: { resultId: string }; Body: OverrideRaceResultBody }>,
  reply: FastifyReply
) {
  try {
    const { resultId } = request.params;
    const { field, adminValue, adminProtected = false } = request.body;

    // Validate field
    const allowedFields = ['position', 'points', 'status', 'time', 'fastestLap'];
    if (!allowedFields.includes(field)) {
      return reply.code(400).send({
        success: false,
        message: `Invalid field. Allowed fields: ${allowedFields.join(', ')}`
      });
    }

    // Get user ID from request (would come from auth)
    const adminUserId = (request as any).user?.id || 'system';

    const result = await f1dataService.overrideRaceResult(
      resultId,
      field,
      adminValue,
      adminProtected,
      adminUserId
    );

    if (!result.success) {
      return reply.code(400).send({
        success: false,
        message: result.error
      });
    }

    return reply.send({
      success: true,
      message: `Successfully overridden ${field} for race result`
    });
  } catch (error) {
    console.error('Error overriding race result:', error);
    return reply.code(500).send({
      success: false,
      message: 'Failed to override race result'
    });
  }
}

/**
 * Create driver substitution
 * POST /api/v1/admin/races/:raceId/substitutions
 */
export async function createDriverSubstitution(
  request: FastifyRequest<{ Params: { raceId: string }; Body: DriverSubstitutionBody }>,
  reply: FastifyReply
) {
  try {
    const { raceId } = request.params;
    const { originalDriverId, replacementDriverId, reason } = request.body;

    if (!originalDriverId || !reason) {
      return reply.code(400).send({
        success: false,
        message: 'originalDriverId and reason are required'
      });
    }

    // Get user ID from request (would come from auth)
    const adminUserId = (request as any).user?.id || 'system';

    const result = await f1dataService.createDriverSubstitution(
      raceId,
      originalDriverId,
      replacementDriverId,
      reason,
      adminUserId
    );

    if (!result.success) {
      return reply.code(400).send({
        success: false,
        message: result.error
      });
    }

    return reply.send({
      success: true,
      data: { substitutionId: result.substitutionId },
      message: 'Driver substitution created successfully'
    });
  } catch (error) {
    console.error('Error creating driver substitution:', error);
    return reply.code(500).send({
      success: false,
      message: 'Failed to create driver substitution'
    });
  }
}

/**
 * Get admin override data for a race result
 * GET /api/v1/admin/race-results/:resultId
 */
export async function getAdminOverrideData(
  request: FastifyRequest<{ Params: { resultId: string } }>,
  reply: FastifyReply
) {
  try {
    const { resultId } = request.params;

    const data = await f1dataService.getAdminOverrideData(resultId);

    if (!data) {
      return reply.code(404).send({
        success: false,
        message: 'Race result not found'
      });
    }

    return reply.send({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching admin override data:', error);
    return reply.code(500).send({
      success: false,
      message: 'Failed to fetch admin override data'
    });
  }
}

/**
 * List all admin overrides for a race
 * GET /api/v1/admin/races/:raceId/overrides
 */
export async function listRaceOverrides(
  request: FastifyRequest<{ Params: { raceId: string } }>,
  reply: FastifyReply
) {
  try {
    const { raceId } = request.params;

    const overrides = await f1dataService.listRaceOverrides(raceId);

    return reply.send({
      success: true,
      data: overrides
    });
  } catch (error) {
    console.error('Error listing race overrides:', error);
    return reply.code(500).send({
      success: false,
      message: 'Failed to list race overrides'
    });
  }
}

/**
 * Resolve a data discrepancy
 * PATCH /api/v1/admin/discrepancies/:discrepancyId/resolve
 */
export async function resolveDiscrepancy(
  request: FastifyRequest<{ Params: ResolveDiscrepancyParams; Body: ResolveDiscrepancyBody }>,
  reply: FastifyReply
) {
  try {
    const { discrepancyId } = request.params;
    const { resolution } = request.body;

    if (!resolution || !['accepted', 'rejected'].includes(resolution)) {
      return reply.code(400).send({
        success: false,
        message: 'resolution must be "accepted" or "rejected"'
      });
    }

    // Get user ID from request (would come from auth)
    const adminUserId = (request as any).user?.id || 'system';

    const result = await f1dataService.resolveDiscrepancy(
      discrepancyId,
      resolution,
      adminUserId
    );

    if (!result.success) {
      return reply.code(400).send({
        success: false,
        message: result.error
      });
    }

    return reply.send({
      success: true,
      message: `Discrepancy ${resolution}`
    });
  } catch (error) {
    console.error('Error resolving discrepancy:', error);
    return reply.code(500).send({
      success: false,
      message: 'Failed to resolve discrepancy'
    });
  }
}
