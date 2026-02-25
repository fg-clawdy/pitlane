/**
 * Job Scheduler
 * Schedules recurring background jobs using BullMQ
 */

import { JOB_NAMES, jolpicaQueue, draftQueue } from './queues';
import { getPrisma } from './instances';

/**
 * Schedule weekly season sync
 * Runs every Monday at 02:00 UTC
 */
export async function scheduleWeeklySeasonSync(): Promise<void> {
  // Add repeatable job for season sync
  await jolpicaQueue.add(
    JOB_NAMES.JOLPICA_SYNC_SEASON,
    { seasonYear: new Date().getFullYear() },
    {
      repeat: {
        pattern: '0 2 * * 1', // Monday 02:00 UTC
      },
      jobId: 'season-sync-weekly',
    }
  );
  
  console.log('[Scheduler] Weekly season sync scheduled for Monday 02:00 UTC');
}

/**
 * Schedule draft window opening jobs for upcoming races
 * Called on app startup and after each race
 */
export async function scheduleDraftWindows(): Promise<void> {
  const prisma = getPrisma();
  
  // Find all upcoming races and schedule draft window open jobs
  const now = new Date();
  const upcomingRaces = await prisma.race.findMany({
    where: {
      date: { gte: now },
    },
    orderBy: { date: 'asc' },
  });

  for (const race of upcomingRaces) {
    // Draft window opens Monday 00:00 GMT of race week
    const raceDate = new Date(race.date);
    const mondayOfRaceWeek = new Date(raceDate);
    mondayOfRaceWeek.setUTCDate(raceDate.getUTCDate() - ((raceDate.getUTCDay() + 6) % 7));
    mondayOfRaceWeek.setUTCHours(0, 0, 0, 0);

    // Only schedule if in the future
    if (mondayOfRaceWeek > now) {
      const delay = mondayOfRaceWeek.getTime() - now.getTime();
      
      await draftQueue.add(
        JOB_NAMES.DRAFT_WINDOW_OPEN,
        { raceId: race.id },
        { delay, jobId: `open-draft-${race.id}` }
      );
      
      console.log(`[Scheduler] Draft window open scheduled for race ${race.raceName} at ${mondayOfRaceWeek.toISOString()}`);
    }
  }
}

/**
 * Initialize all scheduled jobs
 * Should be called on application startup
 */
export async function initializeSchedulers(): Promise<void> {
  try {
    await scheduleWeeklySeasonSync();
    await scheduleDraftWindows();
    console.log('[Scheduler] All recurring jobs scheduled');
  } catch (error) {
    console.error('[Scheduler] Failed to initialize schedulers:', error);
    throw error;
  }
}

/**
 * Remove all scheduled jobs
 * Useful for testing or reinitialization
 */
export async function clearSchedulers(): Promise<void> {
  const repeatableJobs = await jolpicaQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await jolpicaQueue.removeRepeatableByKey(job.key);
  }
  
  const draftJobs = await draftQueue.getRepeatableJobs();
  for (const job of draftJobs) {
    await draftQueue.removeRepeatableByKey(job.key);
  }
  
  console.log('[Scheduler] All scheduled jobs cleared');
}