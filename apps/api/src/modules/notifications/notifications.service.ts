/**
 * Notifications Service
 * Handles creation and queuing of notifications
 */

import { PrismaClient } from '@prisma/client';
import {
  NotificationType,
  TemplateVariables,
  EMAIL_TEMPLATES,
  generateEmailHtml,
  generateEmailText,
  isTransactional,
} from './notifications.types';
import { notificationsQueue, JOB_NAMES } from '../../jobs/queues';

const prisma = new PrismaClient();
const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Create a notification and queue it for delivery
 */
export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  variables?: TemplateVariables;
  skipEmail?: boolean;
  skipPush?: boolean;
}): Promise<{ notificationId: string }> {
  const { userId, type, title, body, data, variables, skipEmail, skipPush } = params;

  // Create notification record
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      data: data ?? undefined,
    },
  });

  // Get user preferences
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailEnabled: true, pushEnabled: true, email: true },
  });

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  // Queue push notification (if enabled and not skipped)
  if (!skipPush && user.pushEnabled) {
    await notificationsQueue.add(
      JOB_NAMES.NOTIFICATION_SEND_PUSH,
      {
        notificationId: notification.id,
        userId,
        title,
        body,
        data: {
          type,
          ...data,
        },
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }
    );
  }

  // Queue email notification
  // Email is sent if:
  // 1. Transactional email (can't be disabled) OR
  // 2. User has emailEnabled: true AND not skipped
  const shouldSendEmail = !skipEmail && (isTransactional(type) || user.emailEnabled);

  if (shouldSendEmail) {
    const template = EMAIL_TEMPLATES[type];
    if (template) {
      const htmlBody = generateEmailHtml(template, variables || {}, baseUrl);
      const textBody = generateEmailText(template, variables || {});

      await notificationsQueue.add(
        JOB_NAMES.NOTIFICATION_SEND_EMAIL,
        {
          notificationId: notification.id,
          userId,
          subject: template.subject,
          htmlBody,
          textBody,
        },
        {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 2000, // Start at 2 seconds, doubles each retry
          },
        }
      );
    }
  }

  return { notificationId: notification.id };
}

/**
 * Create notifications for multiple users
 */
export async function createNotificationsForUsers(params: {
  userIds: string[];
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  getVariables?: (userId: string) => TemplateVariables;
  skipEmail?: boolean;
  skipPush?: boolean;
}): Promise<void> {
  await Promise.all(
    params.userIds.map((userId) =>
      createNotification({
        userId,
        type: params.type,
        title: params.title,
        body: params.body,
        data: params.data,
        variables: params.getVariables?.(userId),
        skipEmail: params.skipEmail,
        skipPush: params.skipPush,
      })
    )
  );
}

/**
 * Get user's notifications (paginated)
 */
export async function getNotifications(params: {
  userId: string;
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: NotificationType;
}): Promise<{
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    data: any;
    read: boolean;
    createdAt: Date;
  }>;
  total: number;
  page: number;
  totalPages: number;
}> {
  const { userId, page = 1, limit = 50, unreadOnly, type } = params;

  const where: any = { userId };
  if (unreadOnly) {
    where.read = false;
  }
  if (type) {
    where.type = type;
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    notifications,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Mark a notification as read
 */
export async function markAsRead(params: { userId: string; notificationId: string }): Promise<void> {
  await prisma.notification.updateMany({
    where: {
      id: params.notificationId,
      userId: params.userId,
    },
    data: { read: true },
  });
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(params: { userId: string }): Promise<void> {
  await prisma.notification.updateMany({
    where: {
      userId: params.userId,
      read: false,
    },
    data: { read: true },
  });
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      userId,
      read: false,
    },
  });
}

/**
 * Convenience methods for common notifications
 */

export async function notifyDraftWindowOpen(params: {
  userId: string;
  leagueId: string;
  leagueName: string;
  raceId: string;
  raceName: string;
}): Promise<void> {
  await createNotification({
    userId: params.userId,
    type: 'draft_window_open',
    title: 'Draft Window Open',
    body: `The draft window for ${params.raceName} is now open in ${params.leagueName}!`,
    data: {
      leagueId: params.leagueId,
      raceId: params.raceId,
    },
    variables: {
      username: params.userId,
      leagueName: params.leagueName,
      raceName: params.raceName,
      url: `${baseUrl}/leagues/${params.leagueId}/draft`,
    },
  });
}

export async function notifyDraftWindowClosing(params: {
  userId: string;
  leagueId: string;
  leagueName: string;
  raceName: string;
  isComplete: boolean;
}): Promise<void> {
  const incompleteMessage = params.isComplete
    ? 'Your picks are complete. Good luck!'
    : "You haven't completed your picks yet. Make sure to submit them before the deadline!";

  await createNotification({
    userId: params.userId,
    type: 'draft_window_closing',
    title: 'Draft Window Closing Soon',
    body: `The draft window for ${params.raceName} closes in 24 hours!`,
    data: {
      leagueId: params.leagueId,
    },
    variables: {
      username: params.userId,
      leagueName: params.leagueName,
      raceName: params.raceName,
      incompleteMessage,
      url: `${baseUrl}/leagues/${params.leagueId}/draft`,
    },
  });
}

export async function notifyYourTurn(params: {
  userId: string;
  leagueId: string;
  leagueName: string;
  raceName: string;
  round: number;
  pickNumber: number;
}): Promise<void> {
  await createNotification({
    userId: params.userId,
    type: 'draft_your_turn',
    title: "It's Your Turn to Draft!",
    body: `Make your pick in ${params.leagueName} - Round ${params.round}, Pick ${params.pickNumber}`,
    data: {
      leagueId: params.leagueId,
      round: params.round,
      pickNumber: params.pickNumber,
    },
    variables: {
      username: params.userId,
      leagueName: params.leagueName,
      raceName: params.raceName,
      round: String(params.round),
      pickNumber: String(params.pickNumber),
      url: `${baseUrl}/leagues/${params.leagueId}/draft`,
    },
  });
}

export async function notifyPickExpired(params: {
  userId: string;
  leagueId: string;
  leagueName: string;
  driverName: string;
}): Promise<void> {
  await createNotification({
    userId: params.userId,
    type: 'draft_pick_expired',
    title: 'Your Pick Has Expired',
    body: `A driver has been automatically assigned: ${params.driverName}`,
    data: {
      leagueId: params.leagueId,
    },
    variables: {
      username: params.userId,
      leagueName: params.leagueName,
      driverName: params.driverName,
      url: `${baseUrl}/leagues/${params.leagueId}`,
    },
  });
}

export async function notifyDraftCompleted(params: {
  userId: string;
  leagueId: string;
  leagueName: string;
  raceName: string;
}): Promise<void> {
  await createNotification({
    userId: params.userId,
    type: 'draft_completed',
    title: 'Draft Complete!',
    body: `The draft for ${params.raceName} in ${params.leagueName} is now complete!`,
    data: {
      leagueId: params.leagueId,
    },
    variables: {
      username: params.userId,
      leagueName: params.leagueName,
      raceName: params.raceName,
      url: `${baseUrl}/leagues/${params.leagueId}`,
    },
  });
}

export async function notifyDriverSubstitution(params: {
  userId: string;
  leagueId: string;
  leagueName: string;
  substitutionDetails: string;
  actionMessage: string;
}): Promise<void> {
  await createNotification({
    userId: params.userId,
    type: 'driver_substitution',
    title: 'Driver Substitution Alert',
    body: params.substitutionDetails,
    data: {
      leagueId: params.leagueId,
    },
    variables: {
      username: params.userId,
      leagueName: params.leagueName,
      substitutionDetails: params.substitutionDetails,
      actionMessage: params.actionMessage,
      url: `${baseUrl}/leagues/${params.leagueId}`,
    },
  });
}

export async function notifyWeeklyWinner(params: {
  userId: string;
  leagueId: string;
  leagueName: string;
  raceName: string;
  score: number;
}): Promise<void> {
  await createNotification({
    userId: params.userId,
    type: 'weekly_winner',
    title: 'Weekly Winner! 🏆',
    body: `Congratulations! You won week ${params.raceName} with ${params.score} points!`,
    data: {
      leagueId: params.leagueId,
      score: params.score,
    },
    variables: {
      username: params.userId,
      leagueName: params.leagueName,
      raceName: params.raceName,
      score: String(params.score),
      url: `${baseUrl}/leagues/${params.leagueId}`,
    },
  });
}

export async function notifyLeagueInvite(params: {
  userId: string;
  leagueId: string;
  leagueName: string;
  inviteToken: string;
}): Promise<void> {
  await createNotification({
    userId: params.userId,
    type: 'league_invite',
    title: 'League Invitation',
    body: `You've been invited to join ${params.leagueName}!`,
    data: {
      leagueId: params.leagueId,
      inviteToken: params.inviteToken,
    },
    variables: {
      username: params.userId,
      leagueName: params.leagueName,
      url: `${baseUrl}/join/${params.inviteToken}`,
    },
  });
}

export async function notifyJoinRequestReceived(params: {
  commissionerId: string;
  requesterName: string;
  leagueId: string;
  leagueName: string;
}): Promise<void> {
  await createNotification({
    userId: params.commissionerId,
    type: 'join_request_received',
    title: 'New Join Request',
    body: `${params.requesterName} wants to join ${params.leagueName}`,
    data: {
      leagueId: params.leagueId,
    },
    variables: {
      username: params.commissionerId,
      requesterName: params.requesterName,
      leagueName: params.leagueName,
      url: `${baseUrl}/leagues/${params.leagueId}/settings/members`,
    },
  });
}

export async function notifyJoinRequestApproved(params: {
  userId: string;
  leagueId: string;
  leagueName: string;
}): Promise<void> {
  await createNotification({
    userId: params.userId,
    type: 'join_request_approved',
    title: 'Join Request Approved!',
    body: `You've been approved to join ${params.leagueName}!`,
    data: {
      leagueId: params.leagueId,
    },
    variables: {
      username: params.userId,
      leagueName: params.leagueName,
      url: `${baseUrl}/leagues/${params.leagueId}`,
    },
  });
}

export async function notifyRemovedFromLeague(params: {
  userId: string;
  leagueName: string;
}): Promise<void> {
  await createNotification({
    userId: params.userId,
    type: 'removed_from_league',
    title: 'Removed from League',
    body: `You have been removed from ${params.leagueName}`,
    variables: {
      username: params.userId,
      leagueName: params.leagueName,
    },
  });
}

export async function notifyDataDiscrepancy(params: {
  commissionerId: string;
  raceName: string;
  discrepancyDetails: string;
  raceId: string;
}): Promise<void> {
  await createNotification({
    userId: params.commissionerId,
    type: 'data_discrepancy',
    title: 'Data Discrepancy Detected',
    body: `A data discrepancy was detected for ${params.raceName}`,
    data: {
      raceId: params.raceId,
    },
    variables: {
      username: params.commissionerId,
      raceName: params.raceName,
      discrepancyDetails: params.discrepancyDetails,
      url: `${baseUrl}/admin/races/${params.raceId}`,
    },
  });
}

export async function notifySeasonPodium(params: {
  userId: string;
  leagueId: string;
  leagueName: string;
  position: string;
  standingsSummary: string;
}): Promise<void> {
  await createNotification({
    userId: params.userId,
    type: 'season_podium',
    title: 'Season Podium Finish! 🏆',
    body: `Congratulations! You finished ${params.position} in ${params.leagueName}!`,
    data: {
      leagueId: params.leagueId,
    },
    variables: {
      username: params.userId,
      leagueName: params.leagueName,
      position: params.position,
      standingsSummary: params.standingsSummary,
      url: `${baseUrl}/leagues/${params.leagueId}`,
    },
  });
}