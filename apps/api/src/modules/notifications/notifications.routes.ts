/**
 * Notifications Routes
 * API endpoints for notification management
 */

import { FastifyInstance } from 'fastify';
import {
  getNotificationsHandler,
  getUnreadCountHandler,
  markAsReadHandler,
  markAllAsReadHandler,
} from './notifications.controller';

export async function notificationsRoutes(fastify: FastifyInstance): Promise<void> {
  // All notification routes require authentication
  fastify.get('/notifications', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, getNotificationsHandler);

  fastify.get('/notifications/unread-count', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, getUnreadCountHandler);

  fastify.patch('/notifications/:notificationId/read', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, markAsReadHandler);

  fastify.post('/notifications/read-all', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, markAllAsReadHandler);
}