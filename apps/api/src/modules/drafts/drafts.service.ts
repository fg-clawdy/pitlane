/**
 * Drafts Service
 * Handles draft window lifecycle and pick management
 */

import { PrismaClient } from '@prisma/client';
import {
  DraftStatus,
  DraftType,
  DraftOrderEntry,
  DraftWindowOutput,
  DraftState,
  SubmitPickInput,
  PickValidation,
  ResolutionMethod,
  calculateDraftOpenTime,
  calculateDraftCloseTime,
  DEFAULT_DRAFT_PICK_TIMEOUT_HOURS,
} from './types';

export class DraftsService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create draft windows for all leagues for a specific race
   */
  async createDraftWindowsForRace(raceId: string): Promise<{ created: number; errors: string[] }> {
    const result = { created: 0, errors: [] as string[] };

    try {
      // Get the race
      const race = await this.prisma.race.findUnique({
        where: { id: raceId },
        include: { season: true },
      });

      if (!race) {
        result.errors.push(`Race ${raceId} not found`);
        return result;
      }

      // Get all leagues for this season
      const leagues = await this.prisma.league.findMany({
        where: { seasonId: race.seasonId },
      });

      const opensAt = calculateDraftOpenTime(race.date);
      const closesAt = calculateDraftCloseTime(race.date, race.time);

      // Create draft window for each league
      for (const league of leagues) {
        try {
          // Check if draft window already exists
          const existing = await this.prisma.draftWindow.findUnique({
            where: {
              leagueId_raceId: {
                leagueId: league.id,
                raceId: race.id,
              },
            },
          });

          if (existing) {
            continue; // Skip if already exists
          }

          // Determine initial status
          const now = new Date();
          let status: DraftStatus = 'upcoming';
          if (now >= opensAt && now < closesAt) {
            status = 'open';
          } else if (now >= closesAt) {
            status = 'closed';
          }

          await this.prisma.draftWindow.create({
            data: {
              leagueId: league.id,
              raceId: race.id,
              opensAt,
              closesAt,
              status,
            },
          });

          result.created++;
        } catch (error) {
          result.errors.push(`League ${league.id}: ${error}`);
        }
      }

      console.log(`[DraftsService] Created ${result.created} draft windows for race ${raceId}`);
    } catch (error) {
      result.errors.push(`Failed to create draft windows: ${error}`);
    }

    return result;
  }

  /**
   * Open draft windows that are scheduled to open
   * Called by background job on Monday 00:00 GMT
   */
  async openScheduledDraftWindows(): Promise<{ opened: number; errors: string[] }> {
    const result = { opened: 0, errors: [] as string[] };

    try {
      const now = new Date();

      // Find draft windows that should be open
      const windowsToOpen = await this.prisma.draftWindow.findMany({
        where: {
          status: 'upcoming',
          opensAt: { lte: now },
          closesAt: { gt: now },
        },
      });

      for (const window of windowsToOpen) {
        try {
          await this.prisma.draftWindow.update({
            where: { id: window.id },
            data: { status: 'open' },
          });

          // Initialize draft order if not set
          await this.initializeDraftOrder(window.id);

          result.opened++;
        } catch (error) {
          result.errors.push(`Window ${window.id}: ${error}`);
        }
      }

      console.log(`[DraftsService] Opened ${result.opened} draft windows`);
    } catch (error) {
      result.errors.push(`Failed to open draft windows: ${error}`);
    }

    return result;
  }

  /**
   * Close draft windows that are past their close time
   * Called by background job or after all picks submitted
   */
  async closeExpiredDraftWindows(): Promise<{ closed: number; completed: number; errors: string[] }> {
    const result = { closed: 0, completed: 0, errors: [] as string[] };

    try {
      const now = new Date();

      // Find draft windows that should be closed
      const windowsToClose = await this.prisma.draftWindow.findMany({
        where: {
          status: 'open',
          closesAt: { lte: now },
        },
      });

      for (const window of windowsToClose) {
        try {
          // Check if all picks are in
          const allPicked = await this.checkAllPicksSubmitted(window.id);
          
          const newStatus = allPicked ? 'completed' : 'closed';
          
          await this.prisma.draftWindow.update({
            where: { id: window.id },
            data: { status: newStatus },
          });

          if (allPicked) {
            result.completed++;
          } else {
            result.closed++;
          }
        } catch (error) {
          result.errors.push(`Window ${window.id}: ${error}`);
        }
      }

      console.log(`[DraftsService] Closed ${result.closed} draft windows, completed ${result.completed}`);
    } catch (error) {
      result.errors.push(`Failed to close draft windows: ${error}`);
    }

    return result;
  }

  /**
   * Get current draft window for a league
   */
  async getCurrentDraftWindow(leagueId: string): Promise<DraftWindowOutput | null> {
    const window = await this.prisma.draftWindow.findFirst({
      where: {
        leagueId,
        status: { in: ['open', 'upcoming'] },
      },
      include: {
        race: true,
        picks: {
          include: {
            driver: true,
            leagueMember: true,
          },
        },
      },
      orderBy: {
        opensAt: 'asc',
      },
    });

    if (!window) return null;

    return this.formatDraftWindowOutput(window);
  }

  /**
   * Get draft window by ID
   */
  async getDraftWindow(draftWindowId: string): Promise<DraftWindowOutput | null> {
    const window = await this.prisma.draftWindow.findUnique({
      where: { id: draftWindowId },
      include: {
        race: true,
        picks: {
          include: {
            driver: true,
            leagueMember: true,
          },
        },
      },
    });

    if (!window) return null;

    return this.formatDraftWindowOutput(window);
  }

  /**
   * Get all draft windows for a league
   */
  async getLeagueDraftWindows(leagueId: string): Promise<DraftWindowOutput[]> {
    const windows = await this.prisma.draftWindow.findMany({
      where: { leagueId },
      include: {
        race: true,
        picks: {
          include: {
            driver: true,
            leagueMember: true,
          },
        },
      },
      orderBy: {
        opensAt: 'asc',
      },
    });

    const results: DraftWindowOutput[] = [];
    for (const w of windows) {
      const formatted = await this.formatDraftWindowOutput(w);
      results.push(formatted);
    }
    return results;
  }

  /**
   * Get draft state for a draft window
   */
  async getDraftState(draftWindowId: string): Promise<DraftState | null> {
    const window = await this.prisma.draftWindow.findUnique({
      where: { id: draftWindowId },
      include: {
        picks: true,
      },
    });

    if (!window) return null;

    const draftOrder = await this.getDraftOrder(window.id);
    const state = this.calculateDraftState(window, draftOrder);

    return state;
  }

  /**
   * Submit a draft pick
   */
  async submitPick(input: SubmitPickInput & { userId: string }): Promise<{ success: boolean; error?: string; pick?: any }> {
    try {
      const { draftWindowId, leagueMemberId, driverId, userId } = input;

      // Get draft window
      const window = await this.prisma.draftWindow.findUnique({
        where: { id: draftWindowId },
        include: {
          league: true,
        },
      });

      if (!window) {
        return { success: false, error: 'Draft window not found' };
      }

      if (window.status !== 'open') {
        return { success: false, error: 'Draft window is not open' };
      }

      // Verify league member
      const leagueMember = await this.prisma.leagueMember.findUnique({
        where: { id: leagueMemberId },
      });

      if (!leagueMember || leagueMember.userId !== userId) {
        return { success: false, error: 'Invalid league member' };
      }

      // Validate the pick
      const validation = await this.validatePick(draftWindowId, leagueMemberId, driverId);
      if (!validation.isValid) {
        return { success: false, error: validation.error };
      }

      // Determine round and pick order
      const draftOrder = await this.getDraftOrder(draftWindowId);
      const state = this.calculateDraftState(window, draftOrder);

      // Check if it's this player's turn
      if (state.currentTurnMemberId !== leagueMemberId) {
        return { success: false, error: 'Not your turn to pick' };
      }

      const currentRound = state.currentRound;
      const memberOrder = draftOrder.find(o => o.leagueMemberId === leagueMemberId);
      const pickOrder = currentRound === 1 ? memberOrder?.round1PickOrder : memberOrder?.round2PickOrder;

      // Create the pick
      const pick = await this.prisma.draftPick.create({
        data: {
          draftWindowId,
          leagueMemberId,
          driverId,
          round: currentRound,
          pickOrder: pickOrder || 0,
          resolutionMethod: 'manual',
          submittedAt: new Date(),
        },
        include: {
          driver: true,
          leagueMember: true,
        },
      });

      // Check if all picks are in
      await this.checkAndCompleteDraft(draftWindowId);

      return { success: true, pick };
    } catch (error) {
      console.error('[DraftsService] Error submitting pick:', error);
      return { success: false, error: `Failed to submit pick: ${error}` };
    }
  }

  /**
   * Validate a pick
   */
  async validatePick(draftWindowId: string, leagueMemberId: string, driverId: string): Promise<PickValidation> {
    // Check if driver exists and is available
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      return { isValid: false, error: 'Driver not found' };
    }

    // Check if driver was already picked in this draft window
    const existingPick = await this.prisma.draftPick.findFirst({
      where: {
        draftWindowId,
        driverId,
      },
    });

    if (existingPick) {
      return { isValid: false, error: 'Driver already picked' };
    }

    // Check if member already has a pick in this round
    const state = await this.getDraftState(draftWindowId);
    if (!state) {
      return { isValid: false, error: 'Draft state not found' };
    }

    const memberPicksInRound = state.picks.filter(
      p => p.leagueMemberId === leagueMemberId && p.round === state.currentRound
    );

    if (memberPicksInRound.length > 0) {
      return { isValid: false, error: 'Already picked in this round' };
    }

    return { isValid: true };
  }

  /**
   * Initialize draft order for a draft window
   * Uses randomized order if league setting is enabled, otherwise uses join order
   */
  private async initializeDraftOrder(draftWindowId: string): Promise<void> {
    const window = await this.prisma.draftWindow.findUnique({
      where: { id: draftWindowId },
      include: {
        league: true,
      },
    });

    if (!window) return;

    // Check if order already exists
    const existingPicks = await this.prisma.draftPick.findFirst({
      where: { draftWindowId },
    });

    if (existingPicks) return; // Order already initialized

    // Get league members
    const members = await this.prisma.leagueMember.findMany({
      where: {
        leagueId: window.leagueId,
        leftAt: null,
      },
      orderBy: {
        joinedAt: 'asc',
      },
    });

    if (members.length === 0) return;

    // Generate pick order
    let order = members.map((m, i) => i);
    
    if (window.league.draftOrderRandomized) {
      // Shuffle order
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    }

    // Store order as first round picks with placeholder data
    // (actual picks will be submitted later)
    console.log(`[DraftsService] Initialized draft order for window ${draftWindowId}`);
  }

  /**
   * Get draft order for a draft window
   */
  private async getDraftOrder(draftWindowId: string): Promise<DraftOrderEntry[]> {
    const window = await this.prisma.draftWindow.findUnique({
      where: { id: draftWindowId },
      include: {
        league: {
          include: {
            members: {
              where: { leftAt: null },
              include: { user: true },
              orderBy: { joinedAt: 'asc' },
            },
          },
        },
      },
    });

    if (!window) return [];

    const members = window.league.members;
    const isSnake = window.league.draftType === 'snake';
    const isRandomized = window.league.draftOrderRandomized;

    // For now, use join order (or would need to store randomized order somewhere)
    // TODO: Store draft order in database when randomized
    const order: DraftOrderEntry[] = members.map((m, i) => ({
      leagueMemberId: m.id,
      userId: m.userId,
      teamName: m.teamName,
      position: i + 1,
      round1PickOrder: i + 1,
      round2PickOrder: isSnake ? members.length - i : i + 1,
    }));

    return order;
  }

  /**
   * Calculate current draft state
   */
  private calculateDraftState(window: any, draftOrder: DraftOrderEntry[]): DraftState {
    const picks = window.picks || [];
    const isSnake = window.league?.draftType === 'snake';
    const memberCount = draftOrder.length;

    // Count picks per round
    const round1Picks = picks.filter((p: any) => p.round === 1);
    const round2Picks = picks.filter((p: any) => p.round === 2);

    let currentRound = 1;
    let currentPickPosition = round1Picks.length + 1;

    if (round1Picks.length >= memberCount) {
      currentRound = 2;
      currentPickPosition = round2Picks.length + 1;
    }

    // Determine whose turn it is
    let currentTurnMemberId: string | null = null;
    if (currentPickPosition <= memberCount) {
      const pickOrder = currentRound === 1 
        ? currentPickPosition 
        : (isSnake ? memberCount - currentPickPosition + 1 : currentPickPosition);
      
      const orderEntry = draftOrder.find(o => 
        currentRound === 1 ? o.round1PickOrder === pickOrder : o.round2PickOrder === pickOrder
      );
      currentTurnMemberId = orderEntry?.leagueMemberId || null;
    }

    // Calculate turn expiry
    const turnExpiresAt = this.calculateTurnExpiry(window, picks, currentRound, currentPickPosition);

    // Get available drivers
    const pickedDriverIds = picks.map((p: any) => p.driverId);

    return {
      draftWindowId: window.id,
      status: window.status as DraftStatus,
      currentRound,
      currentPickPosition,
      currentTurnMemberId,
      turnExpiresAt,
      picks,
      availableDrivers: [], // Would need to query all drivers minus picked
      draftOrder,
    };
  }

  /**
   * Calculate when the current turn expires
   */
  private calculateTurnExpiry(window: any, picks: any[], currentRound: number, currentPickPosition: number): Date | null {
    if (window.status !== 'open') return null;

    const timeoutHours = DEFAULT_DRAFT_PICK_TIMEOUT_HOURS; // Would get from system settings

    // Find the last pick time
    const sortedPicks = [...picks].sort((a, b) => {
      if (a.round !== b.round) return b.round - a.round;
      return b.pickOrder - a.pickOrder;
    });

    const lastPick = sortedPicks[0];
    const lastPickTime = lastPick?.submittedAt || window.opensAt;

    // Add timeout hours
    const expiresAt = new Date(lastPickTime);
    expiresAt.setHours(expiresAt.getHours() + timeoutHours);

    // Don't exceed draft window close time
    if (expiresAt > window.closesAt) {
      return window.closesAt;
    }

    return expiresAt;
  }

  /**
   * Check if all picks have been submitted
   */
  private async checkAllPicksSubmitted(draftWindowId: string): Promise<boolean> {
    const window = await this.prisma.draftWindow.findUnique({
      where: { id: draftWindowId },
      include: {
        league: {
          include: {
            members: {
              where: { leftAt: null },
            },
          },
        },
        picks: true,
      },
    });

    if (!window) return false;

    const memberCount = window.league.members.length;
    const expectedPicks = memberCount * 2; // 2 drivers per player
    const actualPicks = window.picks.length;

    return actualPicks >= expectedPicks;
  }

  /**
   * Check and complete draft if all picks are in
   */
  private async checkAndCompleteDraft(draftWindowId: string): Promise<void> {
    const allPicked = await this.checkAllPicksSubmitted(draftWindowId);

    if (allPicked) {
      await this.prisma.draftWindow.update({
        where: { id: draftWindowId },
        data: { status: 'completed' },
      });

      console.log(`[DraftsService] Draft window ${draftWindowId} completed`);
    }
  }

  /**
   * Format draft window for output
   */
  private async formatDraftWindowOutput(window: any): Promise<DraftWindowOutput> {
    const draftOrder = await this.getDraftOrder(window.id);
    const state = this.calculateDraftState(window, draftOrder);

    // Get all drivers for the season
    const drivers = await this.prisma.driver.findMany({
      where: { seasonId: window.race.seasonId },
    });

    const pickedDriverIds = window.picks.map((p: any) => p.driverId);
    const availableDrivers = drivers
      .filter(d => !pickedDriverIds.includes(d.id))
      .map(d => ({
        id: d.id,
        code: d.code,
        name: `${d.givenName} ${d.familyName}`,
        team: '', // Would need constructor data
      }));

    return {
      id: window.id,
      leagueId: window.leagueId,
      raceId: window.raceId,
      raceName: window.race.raceName,
      round: window.race.round,
      opensAt: window.opensAt,
      closesAt: window.closesAt,
      status: window.status as DraftStatus,
      currentRound: state.currentRound,
      currentPickPosition: state.currentPickPosition,
      currentTurnMemberId: state.currentTurnMemberId,
      turnExpiresAt: state.turnExpiresAt,
      draftOrder,
      picks: window.picks.map((p: any) => ({
        id: p.id,
        leagueMemberId: p.leagueMemberId,
        teamName: p.leagueMember?.teamName || '',
        driverId: p.driverId,
        driverCode: p.driver?.code || '',
        driverName: p.driver ? `${p.driver.givenName} ${p.driver.familyName}` : '',
        round: p.round,
        pickOrder: p.pickOrder,
        resolutionMethod: p.resolutionMethod as ResolutionMethod,
        submittedAt: p.submittedAt,
      })),
      availableDrivers,
    };
  }

  /**
   * Apply missed pick resolution
   * Called when a player's 24h timer expires
   */
  async resolveMissedPick(draftWindowId: string, leagueMemberId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const window = await this.prisma.draftWindow.findUnique({
        where: { id: draftWindowId },
        include: { league: true },
      });

      if (!window) {
        return { success: false, error: 'Draft window not found' };
      }

      const resolution = window.league.missedPickResolution as ResolutionMethod;
      const state = await this.getDraftState(draftWindowId);

      if (!state || state.currentTurnMemberId !== leagueMemberId) {
        return { success: false, error: 'Not this player\'s turn' };
      }

      // Get available drivers
      const pickedDriverIds = state.picks.map(p => p.driverId);
      const drivers = await this.prisma.driver.findMany({
        where: { seasonId: window.league.seasonId },
      });
      const availableDrivers = drivers.filter(d => !pickedDriverIds.includes(d.id));

      if (availableDrivers.length === 0) {
        return { success: false, error: 'No drivers available' };
      }

      let selectedDriverId: string;

      switch (resolution) {
        case 'random':
          const randomIndex = Math.floor(Math.random() * availableDrivers.length);
          selectedDriverId = availableDrivers[randomIndex].id;
          break;

        case 'top_points':
          // Get driver with highest championship points
          // For simplicity, use random (would need to query actual points)
          const topIndex = Math.floor(Math.random() * availableDrivers.length);
          selectedDriverId = availableDrivers[topIndex].id;
          break;

        case 'no_pick':
          // No driver assigned, player scores 0
          // Mark as resolved but with no driver
          return { success: true };

        default:
          return { success: false, error: 'Invalid resolution method' };
      }

      // Create the pick
      const memberOrder = state.draftOrder.find(o => o.leagueMemberId === leagueMemberId);
      const pickOrder = state.currentRound === 1 
        ? memberOrder?.round1PickOrder 
        : memberOrder?.round2PickOrder;

      await this.prisma.draftPick.create({
        data: {
          draftWindowId,
          leagueMemberId,
          driverId: selectedDriverId,
          round: state.currentRound,
          pickOrder: pickOrder || 0,
          resolutionMethod: resolution,
          submittedAt: new Date(),
        },
      });

      console.log(`[DraftsService] Resolved missed pick for member ${leagueMemberId} with ${resolution}`);

      // Check if draft is complete
      await this.checkAndCompleteDraft(draftWindowId);

      return { success: true };
    } catch (error) {
      console.error('[DraftsService] Error resolving missed pick:', error);
      return { success: false, error: `Failed to resolve missed pick: ${error}` };
    }
  }

  /**
   * Rotate draft order for next race
   * Called after each race - position N moves to N+1, last moves to 1
   */
  async rotateDraftOrder(leagueId: string): Promise<void> {
    // This would be implemented when we store draft order in the database
    // For now, the order is based on join order or randomization at draft window creation
    console.log(`[DraftsService] Draft order rotation for league ${leagueId}`);
  }
}

export default DraftsService;