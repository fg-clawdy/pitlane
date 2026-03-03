/**
 * BullMQ Queue Configuration
 * Defines all job queues for the application
 * 
 * NOTE: BullMQ requires Redis maxmemory-policy to be "noeviction" to prevent job data loss.
 * This module automatically sets the correct policy on startup if needed.
 */

import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

// Redis connection options
const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

// Shared Redis connection for queues
const connection = new IORedis(redisOptions);

// Separate connection for QueueEvents (required by BullMQ)
const eventsConnection = new IORedis(redisOptions);

// Automatically set Redis eviction policy to noeviction (required for BullMQ)
// This prevents job data from being evicted when Redis runs low on memory
async function ensureCorrectEvictionPolicy(): Promise<void> {
  try {
    const configConnection = new IORedis(redisOptions);
    
    // Get current maxmemory-policy
    const currentPolicy = await configConnection.config('GET', 'maxmemory-policy');
    const policyValue = Array.isArray(currentPolicy) ? currentPolicy[1] : currentPolicy;
    
    if (policyValue !== 'noeviction') {
      console.log(`[Redis] Current maxmemory-policy is "${policyValue}", setting to "noeviction" for BullMQ compatibility...`);
      await configConnection.config('SET', 'maxmemory-policy', 'noeviction');
      console.log('[Redis] Successfully set maxmemory-policy to "noeviction"');
    }
    
    await configConnection.quit();
  } catch (error) {
    // Log warning but don't fail - the app can still work, just with warnings
    console.warn('[Redis] Could not set maxmemory-policy. If you see eviction warnings, run:');
    console.warn('[Redis]   redis-cli CONFIG SET maxmemory-policy noeviction');
    console.warn('[Redis] Or add "maxmemory-policy noeviction" to your redis.conf');
  }
}

// Run the check
ensureCorrectEvictionPolicy();

// Queue names
export const QUEUE_NAMES = {
  JOLPICA: 'jolpica',
  DRAFT: 'draft',
  SCORING: 'scoring',
  NOTIFICATIONS: 'notifications',
} as const;

// Jolpica sync queue - for season/race/result syncing
export const jolpicaQueue = new Queue(QUEUE_NAMES.JOLPICA, { connection });
export const jolpicaQueueEvents = new QueueEvents(QUEUE_NAMES.JOLPICA, { connection: eventsConnection });

// Draft system queue - for draft window/timer management
export const draftQueue = new Queue(QUEUE_NAMES.DRAFT, { connection });
export const draftQueueEvents = new QueueEvents(QUEUE_NAMES.DRAFT, { connection: eventsConnection });

// Scoring queue - for score calculation
export const scoringQueue = new Queue(QUEUE_NAMES.SCORING, { connection });
export const scoringQueueEvents = new QueueEvents(QUEUE_NAMES.SCORING, { connection: eventsConnection });

// Notifications queue - for push/email delivery
export const notificationsQueue = new Queue(QUEUE_NAMES.NOTIFICATIONS, { connection });
export const notificationsQueueEvents = new QueueEvents(QUEUE_NAMES.NOTIFICATIONS, { connection: eventsConnection });

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
  await Promise.all([
    connection.quit(),
    eventsConnection.quit(),
  ]);
}
