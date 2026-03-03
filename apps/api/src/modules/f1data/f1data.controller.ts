/**
 * F1 Data Controller
 * Handles HTTP requests for F1 data endpoints
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { F1DataService } from './f1data.service';
import { PrismaClient } from '@prisma/client';
import { ApiError, ErrorCode, sendSuccess, sendError, getAuthenticatedUser, getOptionalUser } from '../../lib/api-response';

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
    sendSuccess(reply, seasons);
  } catch (error) {
    _request.log.error(error);
    sendError(reply, error);
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
      throw ApiError.badRequest('Invalid year parameter');
    }

    const races = await f1dataService.getRaces(year);
    sendSuccess(reply, races);
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
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
      throw ApiError.badRequest('Invalid year or round parameter');
    }

    const race = await f1dataService.getRace(year, round);
    
    if (!race) {
      throw ApiError.notFound('Race');
    }

    sendSuccess(reply, race);
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
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
      throw ApiError.badRequest('Invalid year parameter');
    }

    const drivers = await f1dataService.getDrivers(year);
    sendSuccess(reply, drivers);
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
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
      throw ApiError.badRequest('Invalid year parameter');
    }

    const teams = await f1dataService.getTeams(year);
    sendSuccess(reply, teams);
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
  }
}

/**
 * Get all teams (constructors)
 * GET /api/v1/teams
 */
export async function getAllTeams(_request: FastifyRequest, reply: FastifyReply) {
  try {
    const teams = await f1dataService.getAllTeams();
    sendSuccess(reply, teams);
  } catch (error) {
    _request.log.error(error);
    sendError(reply, error);
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
      _request.log.error({ errors: result.errors }, 'Errors during season sync');
    }

    sendSuccess(reply, result);
  } catch (error) {
    _request.log.error(error);
    sendError(reply, error);
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
      throw ApiError.badRequest('Invalid year or round parameter');
    }

    const results = await f1dataService.getRaceResults(year, round);
    sendSuccess(reply, results);
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
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
      throw ApiError.badRequest('Invalid year or round parameter');
    }

    const result = await f1dataService.pollRaceResults(year, round, 1);
    
    if (result.errors.length > 0) {
      request.log.error({ errors: result.errors }, 'Errors during race results sync');
    }

    sendSuccess(reply, {
      resultsSynced: result.resultsSynced,
      raceId: result.raceId,
      discrepancies: result.discrepancies
    });
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
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
      throw ApiError.badRequest(`Invalid field. Allowed fields: ${allowedFields.join(', ')}`);
    }

    // Get user ID from request (would come from auth)
    const user = getOptionalUser(request);
    const adminUserId = user?.id || 'system';

    const result = await f1dataService.overrideRaceResult(
      resultId,
      field,
      adminValue,
      adminProtected,
      adminUserId
    );

    if (!result.success) {
      throw ApiError.badRequest(result.error || 'Failed to override race result');
    }

    sendSuccess(reply, { message: `Successfully overridden ${field} for race result` });
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
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
      throw ApiError.badRequest('originalDriverId and reason are required');
    }

    // Get user ID from request (would come from auth)
    const user = getOptionalUser(request);
    const adminUserId = user?.id || 'system';

    const result = await f1dataService.createDriverSubstitution(
      raceId,
      originalDriverId,
      replacementDriverId,
      reason,
      adminUserId
    );

    if (!result.success) {
      throw ApiError.badRequest(result.error || 'Failed to create driver substitution');
    }

    sendSuccess(reply, { 
      substitutionId: result.substitutionId,
      message: 'Driver substitution created successfully' 
    }, 201);
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
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
      throw ApiError.notFound('Race result');
    }

    sendSuccess(reply, data);
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
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

    sendSuccess(reply, overrides);
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
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
      throw ApiError.badRequest('resolution must be "accepted" or "rejected"');
    }

    // Get user ID from request (would come from auth)
    const user = getOptionalUser(request);
    const adminUserId = user?.id || 'system';

    const result = await f1dataService.resolveDiscrepancy(
      discrepancyId,
      resolution,
      adminUserId
    );

    if (!result.success) {
      throw ApiError.badRequest(result.error || 'Failed to resolve discrepancy');
    }

    sendSuccess(reply, { message: `Discrepancy ${resolution}` });
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
  }
}