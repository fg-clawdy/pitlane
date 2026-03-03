/**
 * BullMQ Queue Configuration
 * Defines all job queues for the application
 */

import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

// Redis connection
const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

// Queue names
export const QUEUE_NAMES = {
  JOLPICA: 'jolpica',
  DRAFT: 'draft',
  SCORING: 'scoring',
  NOTIFICATIONS: 'notifications',
} as const;

// Jolpica sync queue - for season/race/result syncing
export const jolpicaQueue = new Queue(QUEUE_NAMES.JOLPICA, { connection });
export const jolpicaQueueEvents = new QueueEvents(QUEUE_NAMES.JOLPICA, { connection });

// Draft system queue - for draft window/timer management
export const draftQueue = new Queue(QUEUE_NAMES.DRAFT, { connection });
export const draftQueueEvents = new QueueEvents(QUEUE_NAMES.DRAFT, { connection });

// Scoring queue - for score calculation
export const scoringQueue = new Queue(QUEUE_NAMES.SCORING, { connection });
export const scoringQueueEvents = new QueueEvents(QUEUE_NAMES.SCORING, { connection });

// Notifications queue - for push/email delivery
export const notificationsQueue = new Queue(QUEUE_NAMES.NOTIFICATIONS, { connection });
export const notificationsQueueEvents = new QueueEvents(QUEUE_NAMES.NOTIFICATIONS, { connection });

// Job names
export const JOB_NAMES = {
  // Jolpica jobs
  JOLPICA_SYNC_RESULTS: 'jolpica.sync.results',
  JOLPICA_SYNC_SEASON: 'jolpica.sync.season',
  
  // Draft jobs
  DRAFT_WINDOW_OPEN: 'draft.window.open',
  DRAFT_WINDOW_CLOSE: 'draft.window.close',
  DRAFT_PICK_TIMEOUT: 'draft.pick.timeout',
  DRAFT_AUTO_PICK: 'draft.auto_pick',
  
  // Scoring jobs
  SCORING_CALCULATE: 'scoring.calculate',
  
  // Notification jobs
  NOTIFICATION_SEND_PUSH: 'notification.send_push',
  NOTIFICATION_SEND_EMAIL: 'notification.send_email',
  
  // User jobs
  EMAIL_CHANGE_APPLY: 'email_change.apply',
} as const;

// Graceful shutdown
export async function closeQueues(): Promise<void> {
  await Promise.all([
    jolpicaQueue.close(),
    jolpicaQueueEvents.close(),
    draftQueue.close(),
    draftQueueEvents.close(),
    scoringQueue.close(),
    scoringQueueEvents.close(),
    notificationsQueue.close(),
    notificationsQueueEvents.close(),
  ]);
  await connection.quit();
}