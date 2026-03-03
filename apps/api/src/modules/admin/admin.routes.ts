/**
 * Admin Routes
 * Routes for admin dashboard
 */

import { FastifyInstance } from 'fastify';
import { authenticate } from '../../lib/auth';
import {
  getDashboardStatsHandler,
  listUsersHandler,
  getUserHandler,
  updateUserHandler,
  getSystemSettingsHandler,
  getSystemSettingHandler,
  updateSystemSettingHandler,
  listAuditLogsHandler,
  listCommissionerFlagsHandler,
  updateCommissionerFlagHandler,
  listNotificationLogHandler,
  listRacesHandler,
  getRaceForEntryHandler,
  enterRaceResultHandler,
  bulkEnterRaceResultsHandler,
  deleteRaceResultHandler,
} from './admin.controller';

/**
 * Admin routes - all require super_admin role
 */
export async function adminRoutes(fastify: FastifyInstance) {
  // Dashboard stats - admin only
  fastify.get('/api/v1/admin/stats', { preHandler: authenticate }, getDashboardStatsHandler);

  // User management - admin only
  fastify.get('/api/v1/admin/users', { preHandler: authenticate }, listUsersHandler);
  fastify.get('/api/v1/admin/users/:userId', { preHandler: authenticate }, getUserHandler);
  fastify.patch('/api/v1/admin/users/:userId', { preHandler: authenticate }, updateUserHandler);

  // System settings - admin only
  fastify.get('/api/v1/admin/settings', { preHandler: authenticate }, getSystemSettingsHandler);
  fastify.get('/api/v1/admin/settings/:key', { preHandler: authenticate }, getSystemSettingHandler);
  fastify.patch('/api/v1/admin/settings', { preHandler: authenticate }, updateSystemSettingHandler);

  // Audit logs - admin only
  fastify.get('/api/v1/admin/audit-log', { preHandler: authenticate }, listAuditLogsHandler);

  // Commissioner flags - admin only
  fastify.get('/api/v1/admin/flags', { preHandler: authenticate }, listCommissionerFlagsHandler);
  fastify.patch('/api/v1/admin/flags/:flagId', { preHandler: authenticate }, updateCommissionerFlagHandler);

  // Notification log - admin only
  fastify.get('/api/v1/admin/notifications', { preHandler: authenticate }, listNotificationLogHandler);

  // Race data entry - admin only
  fastify.get('/api/v1/admin/races', { preHandler: authenticate }, listRacesHandler);
  fastify.get('/api/v1/admin/races/:raceId', { preHandler: authenticate }, getRaceForEntryHandler);
  fastify.post('/api/v1/admin/races/:raceId/results', { preHandler: authenticate }, enterRaceResultHandler);
  fastify.post('/api/v1/admin/races/:raceId/results/bulk', { preHandler: authenticate }, bulkEnterRaceResultsHandler);
  fastify.delete('/api/v1/admin/races/results/:resultId', { preHandler: authenticate }, deleteRaceResultHandler);
}
