/**
 * Admin Controller
 * Handles admin dashboard HTTP requests
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  getDashboardStats,
  listUsers,
  getUser,
  updateUser,
  getSystemSettings,
  getSystemSetting,
  updateSystemSetting,
  listAuditLogs,
  listCommissionerFlags,
  updateCommissionerFlag,
  listNotificationLog,
  listRacesForAdmin,
  getRaceForDataEntry,
  enterRaceResult,
  bulkEnterRaceResults,
  deleteRaceResult,
} from './admin.service';
import { FinishStatus } from './admin.types';
import { 
  ApiError, 
  sendSuccess, 
  sendError, 
  getAuthenticatedUser, 
  requireAdmin 
} from '../../lib/api-response';
import {
  listUsersQuerySchema,
  updateUserSchema,
  systemSettingSchema,
  enterRaceResultSchema,
  bulkEnterRaceResultsSchema,
  listRacesQuerySchema,
  listAuditLogsQuerySchema,
} from './admin.dto';
import { auditAction } from '../../lib/audit';

/**
 * Get admin dashboard stats
 * GET /api/v1/admin/stats
 */
export async function getDashboardStatsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    requireAdmin(request);
    const stats = await getDashboardStats();
    sendSuccess(reply, { stats });
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
  }
}

/**
 * List users for admin
 * GET /api/v1/admin/users
 */
export async function listUsersHandler(
  request: FastifyRequest<{ Querystring: { page?: number; limit?: number; search?: string; role?: string; status?: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    requireAdmin(request);
    
    const query = listUsersQuerySchema.parse(request.query);
    const result = await listUsers({
      page: query.page,
      limit: query.limit,
      search: query.search,
      role: query.role,
      status: query.status,
    });
    sendSuccess(reply, result);
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
 * List races for admin
 * GET /api/v1/admin/races
 */
export async function listRacesHandler(
  request: FastifyRequest<{ Querystring: { page?: number; limit?: number; seasonYear?: number; hasResults?: boolean } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    requireAdmin(request);
    
    const query = listRacesQuerySchema.parse(request.query);
    const result = await listRacesForAdmin({ page: query.page, limit: query.limit, seasonYear: query.seasonYear, hasResults: query.hasResults });
    sendSuccess(reply, result);
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
 * Get race for data entry
 * GET /api/v1/admin/races/:raceId
 */
export async function getRaceForEntryHandler(
  request: FastifyRequest<{ Params: { raceId: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    requireAdmin(request);
    
    const { raceId } = request.params;
    const race = await getRaceForDataEntry(raceId);

    if (!race) {
      throw ApiError.notFound('Race');
    }

    sendSuccess(reply, { race });
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
  }
}

/**
 * Enter race result
 * POST /api/v1/admin/races/results
 */
export async function enterRaceResultHandler(
  request: FastifyRequest<{ Body: {
    raceId: string;
    driverId: string;
    position: number;
    finishStatus: FinishStatus;
    fastestLap?: boolean;
    time?: string;
    points?: number;
    adminProtected?: boolean;
    notes?: string;
  } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const adminUser = requireAdmin(request);

    const input = enterRaceResultSchema.parse(request.body);
    const result = await enterRaceResult(input as any, adminUser.id);

    if (!result.success) {
      throw ApiError.badRequest(result.error || 'Failed to enter race result');
    }

    await auditAction(request, 'ENTER_RACE_RESULT', 'RaceResult', input.raceId);
    sendSuccess(reply, result);
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
 * Bulk enter race results
 * POST /api/v1/admin/races/results/bulk
 */
export async function bulkEnterRaceResultsHandler(
  request: FastifyRequest<{ Body: {
    raceId: string;
    results: Array<{
      driverCode: string;
      position: number;
      finishStatus: FinishStatus;
      fastestLap?: boolean;
      time?: string;
    }>;
  } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const adminUser = requireAdmin(request);

    const input = bulkEnterRaceResultsSchema.parse(request.body);
    const result = await bulkEnterRaceResults(input as any, adminUser.id);

    if (!result.success) {
      throw ApiError.badRequest(result.error || 'Failed to enter race results');
    }

    await auditAction(request, 'BULK_ENTER_RACE_RESULTS', 'RaceResult', input.raceId);
    sendSuccess(reply, result);
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
 * Delete race result
 * DELETE /api/v1/admin/races/results/:resultId
 */
export async function deleteRaceResultHandler(
  request: FastifyRequest<{ Params: { resultId: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { resultId } = request.params;
    const adminUser = requireAdmin(request);

    const result = await deleteRaceResult(resultId, adminUser.id);

    if (!result.success) {
      throw ApiError.badRequest(result.error || 'Failed to delete race result');
    }

    await auditAction(request, 'DELETE_RACE_RESULT', 'RaceResult', resultId);
    sendSuccess(reply, result);
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
  }
}

/**
 * Get user by ID
 * GET /api/v1/admin/users/:userId
 */
export async function getUserHandler(
  request: FastifyRequest<{ Params: { userId: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    requireAdmin(request);
    const { userId } = request.params;
    const user = await getUser(userId);

    if (!user) {
      throw ApiError.notFound('User');
    }

    sendSuccess(reply, { user });
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
  }
}

/**
 * Update user
 * PATCH /api/v1/admin/users/:userId
 */
export async function updateUserHandler(
  request: FastifyRequest<{ Params: { userId: string }; Body: { username?: string; displayName?: string; role?: 'user' | 'commissioner' | 'super_admin'; status?: 'active' | 'suspended' } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { userId } = request.params;
    const adminUser = requireAdmin(request);

    const input = updateUserSchema.parse(request.body);
    const result = await updateUser(userId, input, adminUser.id);

    if (!result.success) {
      throw ApiError.badRequest(result.error || 'Failed to update user');
    }

    await auditAction(request, 'UPDATE_USER', 'User', userId);
    sendSuccess(reply, result);
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
 * Get all system settings
 * GET /api/v1/admin/settings
 */
export async function getSystemSettingsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    requireAdmin(request);
    const settings = await getSystemSettings();
    sendSuccess(reply, { settings });
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
  }
}

/**
 * Get single system setting
 * GET /api/v1/admin/settings/:key
 */
export async function getSystemSettingHandler(
  request: FastifyRequest<{ Params: { key: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    requireAdmin(request);
    const { key } = request.params;
    const setting = await getSystemSetting(key);

    if (!setting) {
      throw ApiError.notFound('Setting');
    }

    sendSuccess(reply, { setting });
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
  }
}

/**
 * Update system setting
 * PATCH /api/v1/admin/settings
 */
export async function updateSystemSettingHandler(
  request: FastifyRequest<{ Body: { key: string; value: string | number | object } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const adminUser = requireAdmin(request);
    const input = systemSettingSchema.parse(request.body);
    const result = await updateSystemSetting(input, adminUser.id);

    if (!result.success) {
      throw ApiError.badRequest(result.error || 'Failed to update setting');
    }

    await auditAction(request, 'UPDATE_SYSTEM_SETTING', 'SystemSetting', input.key);
    sendSuccess(reply, result);
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
 * List audit logs
 * GET /api/v1/admin/audit
 */
export async function listAuditLogsHandler(
  request: FastifyRequest<{ Querystring: { page?: number; limit?: number; userId?: string; action?: string; entityType?: string; startDate?: string; endDate?: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    requireAdmin(request);
    
    const query = listAuditLogsQuerySchema.parse(request.query);

    const result = await listAuditLogs({
      page: query.page,
      limit: query.limit,
      userId: query.userId,
      action: query.action,
      entityType: query.entityType,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });

    sendSuccess(reply, result);
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
 * List commissioner flags
 * GET /api/v1/admin/flags
 */
export async function listCommissionerFlagsHandler(
  request: FastifyRequest<{ Querystring: { page?: number; limit?: number; status?: 'pending' | 'investigating' | 'resolved' | 'dismissed' } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    requireAdmin(request);
    const { page, limit, status } = request.query;
    const result = await listCommissionerFlags({ page, limit, status });
    sendSuccess(reply, result);
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
  }
}

/**
 * Update commissioner flag
 * PATCH /api/v1/admin/flags/:flagId
 */
export async function updateCommissionerFlagHandler(
  request: FastifyRequest<{ Params: { flagId: string }; Body: { status: 'investigating' | 'resolved' | 'dismissed'; resolution?: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { flagId } = request.params;
    const adminUser = requireAdmin(request);

    const result = await updateCommissionerFlag(flagId, request.body, adminUser.id);

    if (!result.success) {
      throw ApiError.badRequest(result.error || 'Failed to update flag');
    }

    await auditAction(request, 'UPDATE_COMMISSIONER_FLAG', 'CommissionerFlag', flagId);
    sendSuccess(reply, result);
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
  }
}

/**
 * List notification log
 * GET /api/v1/admin/notifications
 */
export async function listNotificationLogHandler(
  request: FastifyRequest<{ Querystring: { page?: number; limit?: number; userId?: string; type?: string; startDate?: string; endDate?: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    requireAdmin(request);
    const { page, limit, userId, type, startDate, endDate } = request.query;

    const result = await listNotificationLog({
      page,
      limit,
      userId,
      type,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    sendSuccess(reply, result);
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
  }
}