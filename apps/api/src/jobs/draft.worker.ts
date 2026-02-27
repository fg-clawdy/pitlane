/**
 * Draft System Worker
 * Handles background jobs for draft window lifecycle and auto-draft
 */

import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { getPrisma, getDraftsService } from './instances';
import { JOB_NAMES, QUEUE_NAMES, draftQueue } from './queues';
import { DraftsService } from '../modules/drafts/drafts.service';
import { PrismaClient } from '@prisma/client';
import {
  notifyDraftWindowOpen,
  notifyDraftWindowClosing,
  notifyYourTurn,
  notifyPickExpired,
  notifyDraftCompleted,
} from '../modules/notifications/notifications.service';

// Redis connection for worker
const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

// Job data types
export interface DraftWindowOpenJobData {
  raceId: string;
}

export interface DraftWindowCloseJobData {
  draftWindowId: string;
  leagueId: string;
}

export interface DraftPickTimeoutJobData {
  draftWindowId: string;
  leagueMemberId: string;
  round: number;
}

export interface DraftAutoPickJobData {
  draftWindowId: string;
  leagueMemberId: string;
  userId: string;
}

/**
 * Draft System Worker
 * Processes jobs from the draft queue
 */
export const draftWorker = new Worker<
  DraftWindowOpenJobData | DraftWindowCloseJobData | DraftPickTimeoutJobData | DraftAutoPickJobData
>(
  QUEUE_NAMES.DRAFT,
  async (job: Job<any>) => {
    console.log(`[DraftWorker] Processing job ${job.name} (${job.id})`);

    try {
      switch (job.name) {
        case JOB_NAMES.DRAFT_WINDOW_OPEN:
          return await handleDraftWindowOpen(job as Job<DraftWindowOpenJobData>);

        case JOB_NAMES.DRAFT_WINDOW_CLOSE:
          return await handleDraftWindowClose(job as Job<DraftWindowCloseJobData>);

        case JOB_NAMES.DRAFT_PICK_TIMEOUT:
          return await handleDraftPickTimeout(job as Job<DraftPickTimeoutJobData>);

        case JOB_NAMES.DRAFT_AUTO_PICK:
          return await handleDraftAutoPick(job as Job<DraftAutoPickJobData>);

        case 'draft.window.closing_reminder':
          return await handleDraftWindowClosingReminder(job as Job<DraftWindowCloseJobData>);

        default:
          throw new Error(`Unknown job name: ${job.name}`);
      }
    } catch (error) {
      console.error(`[DraftWorker] Job ${job.name} failed:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 3, // Process multiple draft jobs concurrently
    limiter: {
      max: 10,
      duration: 1000, // 10 jobs per second
    },
  }
);

/**
 * Handle draft window open job
 * Opens draft windows for a specific race
 */
async function handleDraftWindowOpen(job: Job<DraftWindowOpenJobData>) {
  const { raceId } = job.data;
  const draftsService = getDraftsService();

  console.log(`[DraftWorker] Opening draft windows for race ${raceId}`);

  // Create draft windows for all leagues in this race's season
  const createResult = await draftsService.createDraftWindowsForRace(raceId);

  // Open any windows that should be open now
  const openResult = await draftsService.openScheduledDraftWindows();

  // Schedule close jobs and auto-pick checks for each opened window
  const prisma = getPrisma();
  const windows = await prisma.draftWindow.findMany({
    where: { raceId, status: 'open' },
    include: { league: { include: { members: { where: { leftAt: null } } } } },
  });

  // Get race details for notifications
  const race = await prisma.race.findUnique({
    where: { id: raceId },
  });

  for (const window of windows) {
    // Schedule window close job at closesAt time
    const closeDelay = window.closesAt.getTime() - Date.now();
    if (closeDelay > 0) {
      await draftQueue.add(
        JOB_NAMES.DRAFT_WINDOW_CLOSE,
        { draftWindowId: window.id, leagueId: window.leagueId },
        { delay: closeDelay, jobId: `close-${window.id}` }
      );

      // Schedule "24h before close" reminder notifications
      const reminderDelay = closeDelay - (24 * 60 * 60 * 1000); // 24 hours before close
      if (reminderDelay > 0) {
        await draftQueue.add(
          'draft.window.closing_reminder',
          { draftWindowId: window.id, leagueId: window.leagueId },
          { delay: reminderDelay, jobId: `closing-reminder-${window.id}` }
        );
      }
    }

    // Schedule auto-pick checks for each member at their turn expiry
    // The first member's turn starts immediately
    const members = window.league.members;
    if (members.length > 0) {
      const firstMember = members[0];
      const timeoutHours = 24; // Would get from system settings

      // Schedule auto-pick check for first member
      const autoPickDelay = timeoutHours * 60 * 60 * 1000;
      await draftQueue.add(
        JOB_NAMES.DRAFT_AUTO_PICK,
        { draftWindowId: window.id, leagueMemberId: firstMember.id, userId: firstMember.userId },
        { delay: autoPickDelay, jobId: `autopick-${window.id}-${firstMember.id}-r1` }
      );

      // Notify first member it's their turn
      if (race) {
        await notifyYourTurn({
          userId: firstMember.userId,
          leagueId: window.leagueId,
          leagueName: window.league.name,
          raceName: race.raceName,
          round: 1,
          pickNumber: 1,
        });
      }
    }

    // Send "draft window open" notification to all league members
    if (race) {
      for (const member of members) {
        await notifyDraftWindowOpen({
          userId: member.userId,
          leagueId: window.leagueId,
          leagueName: window.league.name,
          raceId: race.id,
          raceName: race.raceName,
        });
      }
    }
  }

  console.log(`[DraftWorker] Created ${createResult.created} windows, opened ${openResult.opened} windows`);

  return {
    success: true,
    created: createResult.created,
    opened: openResult.opened,
    errors: [...createResult.errors, ...openResult.errors],
  };
}

/**
 * Handle draft window close job
 * Closes draft window and resolves any missed picks
 */
async function handleDraftWindowClose(job: Job<DraftWindowCloseJobData>) {
  const { draftWindowId, leagueId } = job.data;
  const draftsService = getDraftsService();
  const prisma = getPrisma();

  console.log(`[DraftWorker] Closing draft window ${draftWindowId}`);

  // Get the draft window
  const window = await prisma.draftWindow.findUnique({
    where: { id: draftWindowId },
    include: {
      league: { include: { members: { where: { leftAt: null } } } },
      picks: true,
    },
  });

  if (!window) {
    return { success: false, error: 'Draft window not found' };
  }

  if (window.status === 'completed') {
    return { success: true, alreadyCompleted: true };
  }

  // Check for members who haven't picked
  const memberCount = window.league.members.length;
  const expectedPicksPerRound = memberCount;
  const round1Picks = window.picks.filter(p => p.round === 1);
  const round2Picks = window.picks.filter(p => p.round === 2);

  // Resolve missed picks for round 1
  const round1MembersWithPicks = new Set(round1Picks.map(p => p.leagueMemberId));
  for (const member of window.league.members) {
    if (!round1MembersWithPicks.has(member.id)) {
      await draftsService.resolveMissedPick(draftWindowId, member.id);
    }
  }

  // Resolve missed picks for round 2
  const round2MembersWithPicks = new Set(round2Picks.map(p => p.leagueMemberId));
  for (const member of window.league.members) {
    if (!round2MembersWithPicks.has(member.id)) {
      await draftsService.resolveMissedPick(draftWindowId, member.id);
    }
  }

  // Close the window
  const allPicked = await draftsService.checkAllPicksSubmitted(draftWindowId);

  const newStatus = allPicked ? 'completed' : 'closed';

  await prisma.draftWindow.update({
    where: { id: draftWindowId },
    data: { status: newStatus },
  });

  // Send draft completed notification to all members
  if (newStatus === 'completed') {
    const windowWithRace = await prisma.draftWindow.findUnique({
      where: { id: draftWindowId },
      include: {
        race: true,
        league: true,
      },
    });

    if (windowWithRace) {
      for (const member of window.league.members) {
        await notifyDraftCompleted({
          userId: member.userId,
          leagueId: window.leagueId,
          leagueName: window.league.name,
          raceName: windowWithRace.race?.raceName || 'the race',
        });
      }
    }
  }

  console.log(`[DraftWorker] Draft window ${draftWindowId} ${newStatus}`);

  return {
    success: true,
    status: newStatus,
  };
}

/**
 * Handle draft pick timeout job
 * Called when a member's 24h pick timer expires
 */
async function handleDraftPickTimeout(job: Job<DraftPickTimeoutJobData>) {
  const { draftWindowId, leagueMemberId, round } = job.data;
  const draftsService = getDraftsService();
  const prisma = getPrisma();

  console.log(`[DraftWorker] Pick timeout for member ${leagueMemberId} in window ${draftWindowId}`);

  // Get current draft state
  const state = await draftsService.getDraftState(draftWindowId);

  if (!state || state.status !== 'open') {
    return { success: true, skipped: 'Draft not open' };
  }

  // Check if this member already picked in this round
  const existingPick = state.picks.find(
    p => p.leagueMemberId === leagueMemberId && p.round === round
  );

  if (existingPick) {
    return { success: true, skipped: 'Already picked' };
  }

  // Check if it's still this member's turn
  if (state.currentTurnMemberId !== leagueMemberId) {
    return { success: true, skipped: 'Not this member\'s turn' };
  }

  // Get the draft window and league for notifications
  const draftWindow = await prisma.draftWindow.findUnique({
    where: { id: draftWindowId },
    include: {
      league: true,
      race: true,
    },
  });

  // Get member details
  const member = await prisma.leagueMember.findUnique({
    where: { id: leagueMemberId },
  });

  // Resolve the missed pick
  const result = await draftsService.resolveMissedPick(draftWindowId, leagueMemberId);

  // Send "pick expired" notification to the affected member
  if (result.success && member && draftWindow) {
    // Get the assigned driver (if any)
    const assignedPick = await prisma.draftPick.findFirst({
      where: { draftWindowId, leagueMemberId, round },
      include: { driver: true },
    });

    const driverName = assignedPick?.driver
      ? `${assignedPick.driver.givenName} ${assignedPick.driver.familyName}`
      : 'No driver assigned';

    await notifyPickExpired({
      userId: member.userId,
      leagueId: draftWindow.leagueId,
      leagueName: draftWindow.league.name,
      driverName,
    });
  }

  // Schedule auto-pick check for next member and notify them it's their turn
  if (result.success) {
    const updatedState = await draftsService.getDraftState(draftWindowId);
    if (updatedState && updatedState.currentTurnMemberId && updatedState.status === 'open') {
      const timeoutHours = 24; // Would get from system settings
      const autoPickDelay = timeoutHours * 60 * 60 * 1000;

      const nextMember = await prisma.leagueMember.findUnique({
        where: { id: updatedState.currentTurnMemberId },
      });

      if (nextMember && draftWindow) {
        await draftQueue.add(
          JOB_NAMES.DRAFT_AUTO_PICK,
          { draftWindowId, leagueMemberId: nextMember.id, userId: nextMember.userId },
          { delay: autoPickDelay, jobId: `autopick-${draftWindowId}-${nextMember.id}-r${updatedState.currentRound}` }
        );

        // Notify next member it's their turn
        await notifyYourTurn({
          userId: nextMember.userId,
          leagueId: draftWindow.leagueId,
          leagueName: draftWindow.league.name,
          raceName: draftWindow.race?.raceName || 'Unknown Race',
          round: updatedState.currentRound,
          pickNumber: updatedState.currentPickPosition,
        });
      }
    }
  }

  return {
    success: result.success,
    error: result.error,
  };
}

/**
 * Handle draft window closing reminder job
 * Sends 24h reminder to members who haven't completed their picks
 */
async function handleDraftWindowClosingReminder(job: Job<DraftWindowCloseJobData>) {
  const { draftWindowId, leagueId } = job.data;
  const prisma = getPrisma();

  console.log(`[DraftWorker] Sending closing reminder for draft window ${draftWindowId}`);

  // Get the draft window with picks and members
  const window = await prisma.draftWindow.findUnique({
    where: { id: draftWindowId },
    include: {
      league: true,
      picks: true,
      race: true,
    },
  });

  if (!window || window.status !== 'open') {
    return { success: true, skipped: 'Window not open' };
  }

  // Get all league members
  const members = await prisma.leagueMember.findMany({
    where: { leagueId, leftAt: null },
  });

  // Find members who haven't completed both picks
  const memberPickCounts = new Map<string, number>();
  for (const pick of window.picks) {
    const count = memberPickCounts.get(pick.leagueMemberId) || 0;
    memberPickCounts.set(pick.leagueMemberId, count + 1);
  }

  const incompleteMembers = members.filter(m => (memberPickCounts.get(m.id) || 0) < 2);

  // Send reminder notification to incomplete members
  for (const member of incompleteMembers) {
    const isComplete = (memberPickCounts.get(member.id) || 0) >= 2;
    await notifyDraftWindowClosing({
      userId: member.userId,
      leagueId,
      leagueName: window.league.name,
      raceName: window.race.raceName,
      isComplete,
    });
  }

  console.log(`[DraftWorker] Sent closing reminders to ${incompleteMembers.length} members`);

  return {
    success: true,
    remindersSent: incompleteMembers.length,
  };
}

/**
 * Handle auto-draft job
 * Automatically picks a driver for a member based on their preferences
 */
async function handleDraftAutoPick(job: Job<DraftAutoPickJobData>) {
  const { draftWindowId, leagueMemberId, userId } = job.data;
  const draftsService = getDraftsService();
  const prisma = getPrisma();

  console.log(`[DraftWorker] Auto-pick check for member ${leagueMemberId} in window ${draftWindowId}`);

  // Get current draft state
  const state = await draftsService.getDraftState(draftWindowId);

  if (!state || state.status !== 'open') {
    return { success: true, skipped: 'Draft not open' };
  }

  // Check if it's this member's turn
  if (state.currentTurnMemberId !== leagueMemberId) {
    return { success: true, skipped: 'Not this member\'s turn' };
  }

  // Check if member already has picks in both rounds
  const memberPicks = state.picks.filter(p => p.leagueMemberId === leagueMemberId);
  if (memberPicks.length >= 2) {
    return { success: true, skipped: 'Already has 2 picks' };
  }

  // Check if member already picked in current round
  const roundPick = memberPicks.find(p => p.round === state.currentRound);
  if (roundPick) {
    return { success: true, skipped: 'Already picked in this round' };
  }

  // Get member's auto-draft preferences
  const preferredDriverId = await draftsService.getNextAutoDraftDriver(userId, draftWindowId);

  if (!preferredDriverId) {
    // No preferences set - let the timer run for manual pick
    console.log(`[DraftWorker] No auto-draft preferences for member ${leagueMemberId}, skipping`);
    return { success: true, skipped: 'No preferences set' };
  }

  // Submit the pick
  const result = await draftsService.submitPick({
    draftWindowId,
    leagueMemberId,
    driverId: preferredDriverId,
    userId,
  });

  if (result.success) {
    // Schedule auto-pick check for next member
    const updatedState = await draftsService.getDraftState(draftWindowId);
    if (updatedState && updatedState.currentTurnMemberId && updatedState.status === 'open') {
      const timeoutHours = 24;
      const autoPickDelay = timeoutHours * 60 * 60 * 1000;

      const nextMember = await prisma.leagueMember.findUnique({
        where: { id: updatedState.currentTurnMemberId },
      });

      if (nextMember) {
        await draftQueue.add(
          JOB_NAMES.DRAFT_AUTO_PICK,
          { draftWindowId, leagueMemberId: nextMember.id, userId: nextMember.userId },
          { delay: autoPickDelay, jobId: `autopick-${draftWindowId}-${nextMember.id}-r${updatedState.currentRound}` }
        );
      }
    }

    console.log(`[DraftWorker] Auto-picked driver ${preferredDriverId} for member ${leagueMemberId}`);
  }

  return {
    success: result.success,
    error: result.error,
    driverId: preferredDriverId,
  };
}

// Worker event handlers
draftWorker.on('completed', (job: Job) => {
  console.log(`[DraftWorker] Job ${job.name} (${job.id}) completed`);
});

draftWorker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`[DraftWorker] Job ${job?.name} (${job?.id}) failed:`, err.message);
});

draftWorker.on('error', (err: Error) => {
  console.error('[DraftWorker] Worker error:', err);
});

// Graceful shutdown
export async function closeDraftWorker(): Promise<void> {
  await draftWorker.close();
  await connection.quit();
}

export default draftWorker;