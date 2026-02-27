/**
 * Admin Controller
 * Handles admin dashboard HTTP requests
 */

import { FastifyRequest, FastifyReply } from 'fastify';
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

// Dashboard stats
export async function getDashboardStatsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const stats = await getDashboardStats();
  return reply.send({ success: true, stats });
}

// User management
export async function listUsersHandler(
  request: FastifyRequest<{ Querystring: { page?: number; limit?: number; search?: string; role?: string; status?: string } }>,
  reply: FastifyReply
) {
  const { page, limit, search, role, status } = request.query;
  const result = await listUsers({ 
    page, 
    limit, 
    search, 
    role, 
    status: status as 'active' | 'suspended' | 'pending_verification' | undefined 
  });
  return reply.send(result);
}

// Race data entry
export async function listRacesHandler(
  request: FastifyRequest<{ Querystring: { page?: number; limit?: number; seasonYear?: number; hasResults?: boolean } }>,
  reply: FastifyReply
) {
  const { page, limit, seasonYear, hasResults } = request.query;
  const result = await listRacesForAdmin({ page, limit, seasonYear, hasResults });
  return reply.send(result);
}

export async function getRaceForEntryHandler(
  request: FastifyRequest<{ Params: { raceId: string } }>,
  reply: FastifyReply
) {
  const { raceId } = request.params;
  const race = await getRaceForDataEntry(raceId);
  
  if (!race) {
    return reply.code(404).send({ success: false, error: 'Race not found' });
  }
  
  return reply.send({ success: true, race });
}

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
) {
  const adminUserId = (request as any).user?.id || 'system';
  
  const result = await enterRaceResult(request.body, adminUserId);
  
  if (!result.success) {
    return reply.code(400).send(result);
  }
  
  return reply.send(result);
}

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
) {
  const adminUserId = (request as any).user?.id || 'system';
  
  const result = await bulkEnterRaceResults(request.body, adminUserId);
  
  if (!result.success) {
    return reply.code(400).send(result);
  }
  
  return reply.send(result);
}

export async function deleteRaceResultHandler(
  request: FastifyRequest<{ Params: { resultId: string } }>,
  reply: FastifyReply
) {
  const { resultId } = request.params;
  const adminUserId = (request as any).user?.id || 'system';
  
  const result = await deleteRaceResult(resultId, adminUserId);
  
  if (!result.success) {
    return reply.code(400).send(result);
  }
  
  return reply.send(result);
}

export async function getUserHandler(
  request: FastifyRequest<{ Params: { userId: string } }>,
  reply: FastifyReply
) {
  const { userId } = request.params;
  const user = await getUser(userId);
  
  if (!user) {
    return reply.code(404).send({ success: false, error: 'User not found' });
  }
  
  return reply.send({ success: true, user });
}

export async function updateUserHandler(
  request: FastifyRequest<{ Params: { userId: string }; Body: { username?: string; displayName?: string; role?: 'user' | 'commissioner' | 'super_admin'; status?: 'active' | 'suspended' } }>,
  reply: FastifyReply
) {
  const { userId } = request.params;
  const adminUserId = (request as any).user?.id || 'system';
  
  const result = await updateUser(userId, request.body, adminUserId);
  
  if (!result.success) {
    return reply.code(400).send(result);
  }
  
  return reply.send(result);
}

// System settings
export async function getSystemSettingsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const settings = await getSystemSettings();
  return reply.send({ success: true, settings });
}

export async function getSystemSettingHandler(
  request: FastifyRequest<{ Params: { key: string } }>,
  reply: FastifyReply
) {
  const { key } = request.params;
  const setting = await getSystemSetting(key);
  
  if (!setting) {
    return reply.code(404).send({ success: false, error: 'Setting not found' });
  }
  
  return reply.send({ success: true, setting });
}

export async function updateSystemSettingHandler(
  request: FastifyRequest<{ Body: { key: string; value: string | number | object } }>,
  reply: FastifyReply
) {
  const adminUserId = (request as any).user?.id || 'system';
  const result = await updateSystemSetting(request.body, adminUserId);
  
  if (!result.success) {
    return reply.code(400).send(result);
  }
  
  return reply.send(result);
}

// Audit logs
export async function listAuditLogsHandler(
  request: FastifyRequest<{ Querystring: { page?: number; limit?: number; userId?: string; action?: string; entityType?: string; startDate?: string; endDate?: string } }>,
  reply: FastifyReply
) {
  const { page, limit, userId, action, entityType, startDate, endDate } = request.query;
  
  const result = await listAuditLogs({
    page,
    limit,
    userId,
    action,
    entityType,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
  });
  
  return reply.send(result);
}

// Commissioner flags
export async function listCommissionerFlagsHandler(
  request: FastifyRequest<{ Querystring: { page?: number; limit?: number; status?: 'pending' | 'investigating' | 'resolved' | 'dismissed' } }>,
  reply: FastifyReply
) {
  const { page, limit, status } = request.query;
  const result = await listCommissionerFlags({ page, limit, status });
  return reply.send(result);
}

export async function updateCommissionerFlagHandler(
  request: FastifyRequest<{ Params: { flagId: string }; Body: { status: 'investigating' | 'resolved' | 'dismissed'; resolution?: string } }>,
  reply: FastifyReply
) {
  const { flagId } = request.params;
  const adminUserId = (request as any).user?.id || 'system';
  
  const result = await updateCommissionerFlag(flagId, request.body, adminUserId);
  
  if (!result.success) {
    return reply.code(400).send(result);
  }
  
  return reply.send(result);
}

// Notification log
export async function listNotificationLogHandler(
  request: FastifyRequest<{ Querystring: { page?: number; limit?: number; userId?: string; type?: string; startDate?: string; endDate?: string } }>,
  reply: FastifyReply
) {
  const { page, limit, userId, type, startDate, endDate } = request.query;
  
  const result = await listNotificationLog({
    page,
    limit,
    userId,
    type,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
  });
  
  return reply.send(result);
}