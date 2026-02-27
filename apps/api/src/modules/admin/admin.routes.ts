/**
 * Admin Routes
 * Routes for admin dashboard
 */

import { FastifyInstance } from 'fastify';
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
 * Admin routes - all require super_admin role (for now, open)
 */
export async function adminRoutes(fastify: FastifyInstance) {
  // Dashboard stats
  fastify.get('/admin/stats', getDashboardStatsHandler);

  // User management
  fastify.get('/admin/users', listUsersHandler);
  fastify.get('/admin/users/:userId', getUserHandler);
  fastify.patch('/admin/users/:userId', updateUserHandler);

  // System settings
  fastify.get('/admin/settings', getSystemSettingsHandler);
  fastify.get('/admin/settings/:key', getSystemSettingHandler);
  fastify.patch('/admin/settings', updateSystemSettingHandler);

  // Audit logs
  fastify.get('/admin/audit-log', listAuditLogsHandler);

  // Commissioner flags
  fastify.get('/admin/flags', listCommissionerFlagsHandler);
  fastify.patch('/admin/flags/:flagId', updateCommissionerFlagHandler);

  // Notification log
  fastify.get('/admin/notifications', listNotificationLogHandler);

  // Race data entry
  fastify.get('/admin/races', listRacesHandler);
  fastify.get('/admin/races/:raceId', getRaceForEntryHandler);
  fastify.post('/admin/races/:raceId/results', enterRaceResultHandler);
  fastify.post('/admin/races/:raceId/results/bulk', bulkEnterRaceResultsHandler);
  fastify.delete('/admin/races/results/:resultId', deleteRaceResultHandler);
}
