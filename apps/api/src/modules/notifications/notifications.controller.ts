/**
 * Notifications Controller
 * Handles notification API endpoints
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from './notifications.service';
import { NotificationType } from './notifications.types';

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
    const user = (request as any).user;
    if (!user) {
      reply.status(401).send({ error: 'Not authenticated' });
      return;
    }

    const query = request.query as GetNotificationsQuery;
    const { page, limit, unreadOnly, type } = query;

    const result = await getNotifications({
      userId: user.id,
      page,
      limit,
      unreadOnly,
      type,
    });

    reply.status(200).send(result);
  } catch (error) {
    if (error instanceof Error) {
      reply.status(500).send({ error: error.message });
    } else {
      reply.status(500).send({ error: 'Internal server error' });
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
    const user = (request as any).user;
    if (!user) {
      reply.status(401).send({ error: 'Not authenticated' });
      return;
    }

    const count = await getUnreadCount(user.id);

    reply.status(200).send({ count });
  } catch (error) {
    if (error instanceof Error) {
      reply.status(500).send({ error: error.message });
    } else {
      reply.status(500).send({ error: 'Internal server error' });
    }
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
    const user = (request as any).user;
    if (!user) {
      reply.status(401).send({ error: 'Not authenticated' });
      return;
    }

    const params = request.params as MarkAsReadParams;
    const { notificationId } = params;

    await markAsRead({ userId: user.id, notificationId });

    reply.status(200).send({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      reply.status(400).send({ error: error.message });
    } else {
      reply.status(500).send({ error: 'Internal server error' });
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
    const user = (request as any).user;
    if (!user) {
      reply.status(401).send({ error: 'Not authenticated' });
      return;
    }

    await markAllAsRead({ userId: user.id });

    reply.status(200).send({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      reply.status(400).send({ error: error.message });
    } else {
      reply.status(500).send({ error: 'Internal server error' });
    }
  }
}