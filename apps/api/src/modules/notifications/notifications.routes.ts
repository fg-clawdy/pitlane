/**
 * Notifications Routes
 * API endpoints for notification management
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getNotificationsHandler,
  getUnreadCountHandler,
  markAsReadHandler,
  markAllAsReadHandler,
} from './notifications.controller';
import { authenticate } from '../../lib/auth';

/**
 * GET /api/v1/notifications
 * Get user's notifications (authenticated)
 */
async function getNotifications(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await getNotificationsHandler(request, reply);
}

/**
 * GET /api/v1/notifications/unread-count
 * Get unread notification count (authenticated)
 */
async function getUnreadCount(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await getUnreadCountHandler(request, reply);
}

/**
 * PATCH /api/v1/notifications/:notificationId/read
 * Mark a notification as read (authenticated)
 */
async function markAsRead(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await markAsReadHandler(request, reply);
}

/**
 * POST /api/v1/notifications/read-all
 * Mark all notifications as read (authenticated)
 */
async function markAllAsRead(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await markAllAsReadHandler(request, reply);
}

export async function notificationsRoutes(fastify: FastifyInstance): Promise<void> {
  // All notification routes require authentication
  fastify.get('/notifications', {
    preHandler: authenticate,
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, getNotifications);

  fastify.get('/notifications/unread-count', {
    preHandler: authenticate,
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, getUnreadCount);

  fastify.patch('/notifications/:notificationId/read', {
    preHandler: authenticate,
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, markAsRead);

  fastify.post('/notifications/read-all', {
    preHandler: authenticate,
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, markAllAsRead);
}