/**
 * Notifications Worker
 * Handles background jobs for push and email notification delivery
 */

import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import webpush from 'web-push';
import nodemailer from 'nodemailer';
import { getPrisma } from './instances';
import { JOB_NAMES, QUEUE_NAMES } from './queues';

// Redis connection for worker
const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

// Configure web-push with VAPID keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@pitlane.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Create SMTP transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS || '',
    } : undefined,
  });
};

// Job data types
export interface SendPushJobData {
  notificationId: string;
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

export interface SendEmailJobData {
  notificationId: string;
  userId: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
}

export interface EmailChangeApplyJobData {
  requestId: string;
}

/**
 * Notifications Worker
 * Processes jobs from the notifications queue
 */
export const notificationsWorker = new Worker<SendPushJobData | SendEmailJobData>(
  QUEUE_NAMES.NOTIFICATIONS,
  async (job: Job<SendPushJobData | SendEmailJobData>) => {
    console.log(`[NotificationsWorker] Processing job ${job.name} (${job.id})`);

    try {
      switch (job.name) {
        case JOB_NAMES.NOTIFICATION_SEND_PUSH:
          return await handleSendPush(job as Job<SendPushJobData>);
        
        case JOB_NAMES.NOTIFICATION_SEND_EMAIL:
          return await handleSendEmail(job as Job<SendEmailJobData>);
        
        default:
          throw new Error(`Unknown job name: ${job.name}`);
      }
    } catch (error) {
      console.error(`[NotificationsWorker] Job ${job.name} failed:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 5, // Process 5 notifications at a time
    limiter: {
      max: 20,
      duration: 1000, // 20 jobs per second
    },
  }
);

/**
 * Handle push notification sending
 */
async function handleSendPush(job: Job<SendPushJobData>) {
  const { notificationId, userId, title, body, data } = job.data;
  const prisma = getPrisma();

  console.log(`[NotificationsWorker] Sending push notification ${notificationId} to user ${userId}`);

  // Get all push subscriptions for the user
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) {
    console.log(`[NotificationsWorker] No push subscriptions for user ${userId}`);
    return { success: true, sent: 0, noSubscription: true };
  }

  const payload = JSON.stringify({
    title,
    body,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: {
      url: data?.url || '/',
      ...data,
    },
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        }, payload);
        return { success: true, subscriptionId: sub.id };
      } catch (error: any) {
        // 410 Gone means subscription is no longer valid
        if (error.statusCode === 410) {
          await prisma.pushSubscription.delete({
            where: { id: sub.id },
          });
          console.log(`[NotificationsWorker] Deleted expired subscription ${sub.id}`);
        }
        return { success: false, subscriptionId: sub.id, error: error.message };
      }
    })
  );

  const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
  const failed = results.length - successful;

  // Update notification status
  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      pushSent: successful > 0,
      pushFailed: successful === 0,
    },
  });

  console.log(`[NotificationsWorker] Push sent to ${successful}/${subscriptions.length} subscriptions`);

  return {
    success: successful > 0,
    sent: successful,
    failed,
  };
}

/**
 * Handle email notification sending
 */
async function handleSendEmail(job: Job<SendEmailJobData>) {
  const { notificationId, userId, subject, htmlBody, textBody } = job.data;
  const prisma = getPrisma();

  console.log(`[NotificationsWorker] Sending email notification ${notificationId} to user ${userId}`);

  // Get user's email
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, displayName: true, emailEnabled: true },
  });

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  if (!user.emailEnabled) {
    console.log(`[NotificationsWorker] Email notifications disabled for user ${userId}`);
    return { success: true, skipped: true, reason: 'disabled' };
  }

  const transporter = createTransporter();

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'PitLane <noreply@pitlane.app>',
      to: user.email,
      subject,
      html: htmlBody,
      text: textBody || htmlBody.replace(/<[^>]*>/g, ''),
    });

    // Update notification status
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        emailSent: true,
      },
    });

    console.log(`[NotificationsWorker] Email sent to ${user.email}`);

    return { success: true, sent: true };
  } catch (error: any) {
    console.error(`[NotificationsWorker] Failed to send email:`, error);

    // Update notification with failure
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        emailFailed: true,
      },
    });

    throw error;
  }
}

/**
 * Email Change Apply Worker
 * Processes email change requests after hold period
 */
export const emailChangeWorker = new Worker<EmailChangeApplyJobData>(
  'users',
  async (job: Job<EmailChangeApplyJobData>) => {
    console.log(`[EmailChangeWorker] Processing job ${job.name} (${job.id})`);

    if (job.name !== JOB_NAMES.EMAIL_CHANGE_APPLY) {
      throw new Error(`Unknown job name: ${job.name}`);
    }

    const { requestId } = job.data;
    const prisma = getPrisma();

    console.log(`[EmailChangeWorker] Applying email change request ${requestId}`);

    // Get the email change request
    const request = await prisma.emailChangeRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!request) {
      throw new Error(`Email change request ${requestId} not found`);
    }

    // Check if already completed or cancelled (using timestamp fields)
    if (request.completedAt || request.cancelledAt) {
      console.log(`[EmailChangeWorker] Request ${requestId} already processed`);
      return { success: true, alreadyProcessed: true };
    }

    // Check if new email is still available
    const existingUser = await prisma.user.findUnique({
      where: { email: request.newEmail },
    });

    if (existingUser) {
      // Mark as cancelled since we can't complete it
      await prisma.emailChangeRequest.update({
        where: { id: requestId },
        data: { cancelledAt: new Date() },
      });
      throw new Error(`Email ${request.newEmail} is already in use`);
    }

    // Apply the email change
    await prisma.$transaction([
      // Update user's email
      prisma.user.update({
        where: { id: request.userId },
        data: { email: request.newEmail },
      }),
      // Mark request as completed
      prisma.emailChangeRequest.update({
        where: { id: requestId },
        data: { completedAt: new Date() },
      }),
      // Invalidate all refresh tokens (force re-login)
      prisma.refreshToken.deleteMany({
        where: { userId: request.userId },
      }),
    ]);

    console.log(`[EmailChangeWorker] Email changed for user ${request.userId} to ${request.newEmail}`);

    return {
      success: true,
      userId: request.userId,
      newEmail: request.newEmail,
    };
  },
  {
    connection,
    concurrency: 1,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

// Worker event handlers
notificationsWorker.on('completed', (job: Job) => {
  console.log(`[NotificationsWorker] Job ${job.name} (${job.id}) completed`);
});

notificationsWorker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`[NotificationsWorker] Job ${job?.name} (${job?.id}) failed:`, err.message);
});

notificationsWorker.on('error', (err: Error) => {
  console.error('[NotificationsWorker] Worker error:', err);
});

emailChangeWorker.on('completed', (job: Job) => {
  console.log(`[EmailChangeWorker] Job ${job.name} (${job.id}) completed`);
});

emailChangeWorker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`[EmailChangeWorker] Job ${job?.name} (${job?.id}) failed:`, err.message);
});

emailChangeWorker.on('error', (err: Error) => {
  console.error('[EmailChangeWorker] Worker error:', err);
});

// Graceful shutdown
export async function closeNotificationsWorker(): Promise<void> {
  await notificationsWorker.close();
  await emailChangeWorker.close();
  await connection.quit();
}

export default notificationsWorker;