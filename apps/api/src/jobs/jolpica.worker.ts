/**
 * Jolpica Sync Worker
 * Handles background jobs for Jolpica data synchronization
 */

import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { getPrisma, getF1DataService, getScoringService } from './instances';
import { JOB_NAMES, QUEUE_NAMES, jolpicaQueue, scoringQueue } from './queues';
import { ScoringService } from '../modules/scoring/scoring.service';
import { F1DataService } from '../modules/f1data/f1data.service';

// Redis connection for worker
const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

// Job data types
export interface SyncResultsJobData {
  seasonYear: number;
  round: number;
  attemptNumber: number;
}

export interface SyncSeasonJobData {
  seasonYear?: number;
}

/**
 * Jolpica Sync Worker
 * Processes jobs from the jolpica queue
 */
export const jolpicaWorker = new Worker<SyncResultsJobData | SyncSeasonJobData>(
  QUEUE_NAMES.JOLPICA,
  async (job: Job<SyncResultsJobData | SyncSeasonJobData>) => {
    console.log(`[JolpicaWorker] Processing job ${job.name} (${job.id})`);

    try {
      switch (job.name) {
        case JOB_NAMES.JOLPICA_SYNC_RESULTS:
          return await handleSyncResults(job as Job<SyncResultsJobData>);
        
        case JOB_NAMES.JOLPICA_SYNC_SEASON:
          return await handleSyncSeason(job as Job<SyncSeasonJobData>);
        
        default:
          throw new Error(`Unknown job name: ${job.name}`);
      }
    } catch (error) {
      console.error(`[JolpicaWorker] Job ${job.name} failed:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 1, // Process one job at a time to avoid rate limiting
    limiter: {
      max: 1,
      duration: 2000, // 1 job per 2 seconds
    },
  }
);

/**
 * Handle race results sync job
 * Polls Jolpica for race results with retry logic
 */
async function handleSyncResults(job: Job<SyncResultsJobData>) {
  const { seasonYear, round, attemptNumber } = job.data;
  const f1dataService = getF1DataService();
  
  console.log(`[JolpicaWorker] Syncing results for ${seasonYear} round ${round} (attempt ${attemptNumber})`);

  const result = await f1dataService.pollRaceResults(seasonYear, round, attemptNumber);

  if (result.resultsSynced > 0) {
    console.log(`[JolpicaWorker] Synced ${result.resultsSynced} results for ${seasonYear} round ${round}`);
    
    // Queue score calculation after successful sync
    await scoringQueue.add(
      JOB_NAMES.SCORING_CALCULATE,
      { seasonYear, round },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      }
    );
    
    return {
      success: true,
      resultsSynced: result.resultsSynced,
      discrepancies: result.discrepancies.length,
    };
  }

  if (result.needsRetry) {
    // Schedule retry with exponential backoff (2 hours)
    const delay = 2 * 60 * 60 * 1000; // 2 hours in ms
    await jolpicaQueue.add(
      JOB_NAMES.JOLPICA_SYNC_RESULTS,
      { seasonYear, round, attemptNumber: attemptNumber + 1 },
      { delay }
    );
    
    return {
      success: false,
      retryScheduled: true,
      attemptNumber: attemptNumber + 1,
    };
  }

  // Max retries reached - logged by service
  return {
    success: false,
    retryScheduled: false,
    errors: result.errors,
  };
}

/**
 * Handle season sync job
 * Syncs season schedule, races, and drivers
 */
async function handleSyncSeason(job: Job<SyncSeasonJobData>) {
  const seasonYear = job.data.seasonYear || new Date().getFullYear();
  const f1dataService = getF1DataService();
  
  console.log(`[JolpicaWorker] Syncing season ${seasonYear}`);
  
  const result = await f1dataService.syncSeason(seasonYear);
  
  console.log(`[JolpicaWorker] Season ${seasonYear} synced: ${result.racesSynced} races, ${result.driversSynced} drivers`);
  
  return {
    success: result.errors.length === 0,
    seasonYear,
    racesSynced: result.racesSynced,
    driversSynced: result.driversSynced,
    errors: result.errors,
  };
}

// Worker event handlers
jolpicaWorker.on('completed', (job: Job) => {
  console.log(`[JolpicaWorker] Job ${job.name} (${job.id}) completed`);
});

jolpicaWorker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`[JolpicaWorker] Job ${job?.name} (${job?.id}) failed:`, err.message);
});

jolpicaWorker.on('error', (err: Error) => {
  console.error('[JolpicaWorker] Worker error:', err);
});

// Graceful shutdown
export async function closeJolpicaWorker(): Promise<void> {
  await jolpicaWorker.close();
  await connection.quit();
}

export default jolpicaWorker;