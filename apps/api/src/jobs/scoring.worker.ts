/**
 * Scoring Worker
 * Handles background jobs for score calculation
 */

import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { getScoringService } from './instances';
import { JOB_NAMES, QUEUE_NAMES } from './queues';

// Redis connection for worker
const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

// Job data types
export interface ScoringCalculateJobData {
  seasonYear: number;
  round: number;
  raceId?: string; // Optional: if not provided, will be looked up
}

/**
 * Scoring Worker
 * Processes jobs from the scoring queue
 */
export const scoringWorker = new Worker<ScoringCalculateJobData>(
  QUEUE_NAMES.SCORING,
  async (job: Job<ScoringCalculateJobData>) => {
    console.log(`[ScoringWorker] Processing job ${job.name} (${job.id})`);

    try {
      switch (job.name) {
        case JOB_NAMES.SCORING_CALCULATE:
          return await handleScoringCalculate(job);
        
        default:
          throw new Error(`Unknown job name: ${job.name}`);
      }
    } catch (error) {
      console.error(`[ScoringWorker] Job ${job.name} failed:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 2, // Process 2 scoring jobs at a time
    limiter: {
      max: 5,
      duration: 1000, // 5 jobs per second
    },
  }
);

/**
 * Handle score calculation job
 * Calculates scores for all leagues for a specific race
 */
async function handleScoringCalculate(job: Job<ScoringCalculateJobData>) {
  const { seasonYear, round, raceId } = job.data;
  const scoringService = getScoringService();
  const prisma = (scoringService as any).prisma;

  console.log(`[ScoringWorker] Calculating scores for ${seasonYear} round ${round}`);

  // Get race ID if not provided
  let targetRaceId = raceId;
  if (!targetRaceId) {
    const race = await prisma.race.findFirst({
      where: {
        season: { year: seasonYear },
        round,
      },
    });
    
    if (!race) {
      throw new Error(`Race not found for ${seasonYear} round ${round}`);
    }
    targetRaceId = race.id;
  }

  // Verify race has results
  const resultsCount = await prisma.raceResult.count({
    where: { raceId: targetRaceId! },
  });

  if (resultsCount === 0) {
    throw new Error(`No race results found for ${seasonYear} round ${round}`);
  }

  // Calculate and save scores for all leagues
  const result = await scoringService.calculateAndSaveAllLeagueScores(targetRaceId!);

  console.log(`[ScoringWorker] Processed ${result.leaguesProcessed} leagues for ${seasonYear} round ${round}`);

  if (result.errors.length > 0) {
    console.error(`[ScoringWorker] Errors:`, result.errors);
  }

  return {
    success: result.errors.length === 0,
    raceId: targetRaceId,
    leaguesProcessed: result.leaguesProcessed,
    errors: result.errors,
  };
}

// Worker event handlers
scoringWorker.on('completed', (job: Job) => {
  console.log(`[ScoringWorker] Job ${job.name} (${job.id}) completed`);
});

scoringWorker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`[ScoringWorker] Job ${job?.name} (${job?.id}) failed:`, err.message);
});

scoringWorker.on('error', (err: Error) => {
  console.error('[ScoringWorker] Worker error:', err);
});

// Graceful shutdown
export async function closeScoringWorker(): Promise<void> {
  await scoringWorker.close();
  await connection.quit();
}

export default scoringWorker;