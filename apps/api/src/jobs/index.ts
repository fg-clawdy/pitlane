/**
 * Jobs Module Entry Point
 * Exports all job queues, workers, and schedulers
 */

// Queue configuration
export {
  QUEUE_NAMES,
  JOB_NAMES,
  jolpicaQueue,
  jolpicaQueueEvents,
  draftQueue,
  draftQueueEvents,
  scoringQueue,
  scoringQueueEvents,
  notificationsQueue,
  notificationsQueueEvents,
  closeQueues,
} from './queues';

// Service instances
export {
  initializeServices,
  getPrisma,
  getF1DataService,
  getScoringService,
  getDraftsService,
} from './instances';

// Workers
export { jolpicaWorker, closeJolpicaWorker } from './jolpica.worker';
export { draftWorker, closeDraftWorker } from './draft.worker';

// Scheduler
export {
  scheduleWeeklySeasonSync,
  scheduleDraftWindows,
  initializeSchedulers,
  clearSchedulers,
} from './scheduler';

// Type exports for job data
export type { SyncResultsJobData, SyncSeasonJobData } from './jolpica.worker';