/**
 * Notifications Controller
 * Handles notification API endpoints
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from './notifications.service';
import { NotificationType } from './notifications.types';
import { ApiError, ErrorCode, sendSuccess, sendError, getAuthenticatedUser } from '../../lib/api-response';
import {
  getNotificationsQuerySchema,
  markAsReadSchema,
  markAllAsReadSchema,
} from './notifications.dto';

// Request types
interface GetNotificationsQuery {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: NotificationType;
}

interface MarkAsReadParams {
  notificationId: string;
}

/**
 * Get user's notifications (paginated)
 */
export async function getNotificationsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);

    const query = getNotificationsQuerySchema.parse(request.query);

    const result = await getNotifications({
      userId: user.id,
      page: query.page,
      limit: query.limit,
      unreadOnly: query.unreadOnly,
      type: query.type,
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
 * Get unread notification count
 */
export async function getUnreadCountHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);

    const count = await getUnreadCount(user.id);

    sendSuccess(reply, { count });
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
  }
}

/**
 * Mark a notification as read
 */
export async function markAsReadHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);

    const params = markAsReadSchema.parse(request.params);

    await markAsRead({ userId: user.id, notificationId: params.notificationId });

    sendSuccess(reply, { message: 'Notification marked as read' });
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
 * Mark all notifications as read
 */
export async function markAllAsReadHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);

    await markAllAsRead({ userId: user.id });

    sendSuccess(reply, { message: 'All notifications marked as read' });
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
  }
}