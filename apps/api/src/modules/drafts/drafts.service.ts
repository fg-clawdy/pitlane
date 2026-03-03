/**
 * Drafts Service
 * Handles draft window lifecycle and pick management
 */

import { PrismaClient } from '@prisma/client';
import { ApiError } from '../../lib/api-response';
import {
  DraftStatus,
  DraftType,
  DraftOrderEntry,
  DraftWindowOutput,
  DraftState,
  SubmitPickInput,
  PickValidation,
  ResolutionMethod,
  PickSubmittedPayload,
  AutoDraftPreferenceEntry,
  AutoDraftPreferencesOutput,
  SetAutoDraftPreferencesInput,
  calculateDraftOpenTime,
  calculateDraftCloseTime,
  DEFAULT_DRAFT_PICK_TIMEOUT_HOURS,
  SubstitutionPolicy,
  SubstitutionImpact,
  RedraftWindow,
} from './types';

export class DraftsService {
  private prisma: PrismaClient;
  private websocketClients: Map<string, Set<any>> = new Map(); // leagueId -> Set of WebSocket connections

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Register a WebSocket client for a league's draft updates
   */
  registerWebSocketClient(leagueId: string, client: any): void {
    if (!this.websocketClients.has(leagueId)) {
      this.websocketClients.set(leagueId, new Set());
    }
    this.websocketClients.get(leagueId)!.add(client);
    console.log(`[DraftsService] WebSocket client registered for league ${leagueId}`);
  }

  /**
   * Unregister a WebSocket client
   */
  unregisterWebSocketClient(leagueId: string, client: any): void {
    const clients = this.websocketClients.get(leagueId);
    if (clients) {
      clients.delete(client);
      if (clients.size === 0) {
        this.websocketClients.delete(leagueId);
      }
    }
    console.log(`[DraftsService] WebSocket client unregistered for league ${leagueId}`);
  }

  /**
   * Broadcast a message to all WebSocket clients for a league
   */
  private broadcastToLeague(leagueId: string, message: any): void {
    const clients = this.websocketClients.get(leagueId);
    if (!clients || clients.size === 0) return;

    const messageStr = JSON.stringify(message);
    for (const client of clients) {
      try {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(messageStr);
        }
      } catch (error) {
        console.error('[DraftsService] Error broadcasting to client:', error);
      }
    }
    console.log(`[DraftsService] Broadcast to ${clients.size} clients for league ${leagueId}`);
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

      // Get draft order and state
      const draftOrder = await this.getDraftOrder(draftWindowId);
      const state = this.calculateDraftState(window, draftOrder);

      // Check if it's this player's turn
      if (state.currentTurnMemberId !== leagueMemberId) {
        return { success: false, error: 'Not your turn to pick' };
      }

      const currentRound = state.currentRound;
      const memberOrder = draftOrder.find(o => o.leagueMemberId === leagueMemberId);
      const pickOrder = currentRound === 1 ? memberOrder?.round1PickOrder : memberOrder?.round2PickOrder;

      // Use transaction to prevent race condition on driver pick
      let pick: any;
      try {
        await this.prisma.$transaction(async (tx) => {
          // Check if driver exists and belongs to the correct season
          const driver = await tx.driver.findUnique({
            where: { id: driverId },
          });

          if (!driver) {
            throw ApiError.notFound('Driver');
          }

          // Verify driver belongs to this league's season
          if (driver.seasonId !== window.league.seasonId) {
            throw ApiError.badRequest('Driver is not from this season');
          }

          // Check if driver was already picked in this draft window (within transaction)
          const existingPick = await tx.draftPick.findFirst({
            where: {
              draftWindowId,
              driverId,
            },
          });

          if (existingPick) {
            throw ApiError.driverAlreadyPicked();
          }

          // Check if member already has a pick in this round
          const memberPicksInRound = await tx.draftPick.count({
            where: {
              draftWindowId,
              leagueMemberId,
              round: currentRound,
            },
          });

          if (memberPicksInRound > 0) {
            throw ApiError.notYourTurn('You already have a pick in this round');
          }

          // Create the pick
          pick = await tx.draftPick.create({
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
        });
      } catch (txError) {
        if (txError instanceof Error) {
          return { success: false, error: txError.message };
        }
        return { success: false, error: 'Failed to submit pick due to transaction error' };
      }

      // Get updated state after pick
      const updatedWindow = await this.prisma.draftWindow.findUnique({
        where: { id: draftWindowId },
        include: { league: true },
      });
      const updatedState = this.calculateDraftState(updatedWindow, draftOrder);

      // Check if all picks are in
      const allPicked = await this.checkAllPicksSubmitted(draftWindowId);
      
      if (allPicked) {
        await this.prisma.draftWindow.update({
          where: { id: draftWindowId },
          data: { status: 'completed' },
        });
      }

      // Broadcast pick to all league members via WebSocket
      const pickPayload: PickSubmittedPayload = {
        pick: {
          id: pick.id,
          leagueMemberId: pick.leagueMemberId,
          teamName: pick.leagueMember?.teamName || '',
          driverId: pick.driverId,
          driverCode: pick.driver?.code || '',
          driverName: pick.driver ? `${pick.driver.givenName} ${pick.driver.familyName}` : '',
          round: pick.round,
          pickOrder: pick.pickOrder,
          resolutionMethod: pick.resolutionMethod as ResolutionMethod,
          submittedAt: pick.submittedAt,
        },
        nextTurn: allPicked ? null : {
          leagueMemberId: updatedState.currentTurnMemberId,
          teamName: draftOrder.find(o => o.leagueMemberId === updatedState.currentTurnMemberId)?.teamName || null,
          round: updatedState.currentRound,
          expiresAt: updatedState.turnExpiresAt,
        },
        draftCompleted: allPicked,
      };

      this.broadcastToLeague(window.leagueId, {
        type: allPicked ? 'draft_completed' : 'pick_submitted',
        payload: pickPayload,
        timestamp: new Date(),
      });

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
  async checkAllPicksSubmitted(draftWindowId: string): Promise<boolean> {
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

    // Get all drivers for the season with their race results for points
    const drivers = await this.prisma.driver.findMany({
      where: { seasonId: window.race.seasonId },
      include: {
        results: {
          include: { race: true },
          orderBy: { race: { date: 'desc' } },
          take: 1,
        },
      },
    });

    // Get season points for each driver (sum of all race results)
    const driverPoints: Map<string, number> = new Map();
    const driverLastPosition: Map<string, number | null> = new Map();

    for (const driver of drivers) {
      const allResults = await this.prisma.raceResult.findMany({
        where: { driverId: driver.id, race: { seasonId: window.race.seasonId } },
      });
      
      const totalPoints = allResults.reduce((sum, r) => sum + (r.points || 0), 0);
      driverPoints.set(driver.id, totalPoints);

      // Last race position
      const lastResult = allResults.sort((a, b) => {
        // Sort by race date descending
        return 0; // Already sorted above
      })[0];
      
      driverLastPosition.set(driver.id, lastResult?.position || null);
    }

    const pickedDriverIds = window.picks.map((p: any) => p.driverId);
    const availableDrivers = drivers
      .filter(d => !pickedDriverIds.includes(d.id))
      .map(d => ({
        id: d.id,
        code: d.code,
        name: `${d.givenName} ${d.familyName}`,
        team: '', // Would need constructor data
        seasonPoints: driverPoints.get(d.id) || 0,
        lastRacePosition: driverLastPosition.get(d.id) || null,
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

  /**
   * Get user's auto-draft preferences
   */
  async getAutoDraftPreferences(userId: string): Promise<AutoDraftPreferencesOutput> {
    const preferences = await this.prisma.autoDraftPreference.findMany({
      where: { userId },
      orderBy: { rank: 'asc' },
    });

    // Get driver details for each preference
    const driverIds = preferences.map(p => p.driverId);
    const drivers = await this.prisma.driver.findMany({
      where: { id: { in: driverIds } },
    });
    const driverMap = new Map(drivers.map(d => [d.id, d]));

    return {
      preferences: preferences.map(p => {
        const driver = driverMap.get(p.driverId);
        return {
          id: p.id,
          userId: p.userId,
          driverId: p.driverId,
          driverCode: driver?.code || '',
          driverName: driver ? `${driver.givenName} ${driver.familyName}` : '',
          rank: p.rank,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        };
      }),
    };
  }

  /**
   * Set user's auto-draft preferences
   * Replaces all existing preferences with new ones
   */
  async setAutoDraftPreferences(userId: string, input: SetAutoDraftPreferencesInput): Promise<AutoDraftPreferencesOutput> {
    // Validate that all drivers exist
    const driverIds = input.preferences.map(p => p.driverId);
    const drivers = await this.prisma.driver.findMany({
      where: { id: { in: driverIds } },
    });

    if (drivers.length !== driverIds.length) {
      const foundIds = new Set(drivers.map(d => d.id));
      const missingIds = driverIds.filter(id => !foundIds.has(id));
      throw new Error(`Drivers not found: ${missingIds.join(', ')}`);
    }

    // Validate ranks are unique and positive
    const ranks = input.preferences.map(p => p.rank);
    const uniqueRanks = new Set(ranks);
    if (uniqueRanks.size !== ranks.length) {
      throw new Error('Duplicate ranks are not allowed');
    }
    if (ranks.some(r => r < 1)) {
      throw new Error('Ranks must be positive integers');
    }

    // Delete existing preferences and create new ones in a transaction
    await this.prisma.$transaction(async (tx) => {
      // Delete all existing preferences for this user
      await tx.autoDraftPreference.deleteMany({
        where: { userId },
      });

      // Create new preferences
      for (const pref of input.preferences) {
        await tx.autoDraftPreference.create({
          data: {
            userId,
            driverId: pref.driverId,
            rank: pref.rank,
          },
        });
      }
    });

    // Return the new preferences
    return this.getAutoDraftPreferences(userId);
  }

  /**
   * Commissioner override: Reassign a draft pick to a different driver
   * Used for edge cases where commissioner needs to correct a pick
   */
  async commissionerOverridePick(
    draftWindowId: string,
    pickId: string,
    newDriverId: string,
    commissionerUserId: string
  ): Promise<{ success: boolean; error?: string; pick?: any }> {
    try {
      // Get draft window with league
      const window = await this.prisma.draftWindow.findUnique({
        where: { id: draftWindowId },
        include: {
          league: {
            include: {
              members: {
                where: { leftAt: null },
                orderBy: { joinedAt: 'asc' },
              },
            },
          },
        },
      });

      if (!window) {
        return { success: false, error: 'Draft window not found' };
      }

      // Verify user is commissioner (first member)
      const commissioner = window.league.members[0];
      if (!commissioner || commissioner.userId !== commissionerUserId) {
        return { success: false, error: 'Only the commissioner can override picks' };
      }

      // Get the pick to override
      const pick = await this.prisma.draftPick.findUnique({
        where: { id: pickId },
        include: { driver: true, leagueMember: true },
      });

      if (!pick || pick.draftWindowId !== draftWindowId) {
        return { success: false, error: 'Pick not found in this draft window' };
      }

      // Verify new driver exists and is available
      const newDriver = await this.prisma.driver.findUnique({
        where: { id: newDriverId },
      });

      if (!newDriver) {
        return { success: false, error: 'Driver not found' };
      }

      // Check if new driver was already picked by someone else
      const existingPick = await this.prisma.draftPick.findFirst({
        where: {
          draftWindowId,
          driverId: newDriverId,
          id: { not: pickId }, // Exclude the current pick being modified
        },
      });

      if (existingPick) {
        return { success: false, error: 'Driver already picked by another member' };
      }

      // Store old driver for audit
      const oldDriverId = pick.driverId;
      const oldDriverCode = pick.driver?.code;

      // Update the pick
      const updatedPick = await this.prisma.draftPick.update({
        where: { id: pickId },
        data: {
          driverId: newDriverId,
          resolutionMethod: 'commissioner_override',
        },
        include: {
          driver: true,
          leagueMember: true,
        },
      });

      // Create audit log
      await this.prisma.auditLog.create({
        data: {
          action: 'draft_pick_override',
          entityType: 'DraftPick',
          entityId: pickId,
          userId: commissionerUserId,
          changes: { 
            oldValue: { driverId: oldDriverId, driverCode: oldDriverCode }, 
            newValue: { driverId: newDriverId, driverCode: newDriver.code } 
          },
        },
      });

      // Broadcast update to league
      this.broadcastToLeague(window.leagueId, {
        type: 'pick_override',
        payload: {
          pickId,
          leagueMemberId: pick.leagueMemberId,
          teamName: pick.leagueMember?.teamName || '',
          oldDriverCode: oldDriverCode,
          newDriverCode: newDriver.code,
          newDriverName: `${newDriver.givenName} ${newDriver.familyName}`,
          round: pick.round,
        },
        timestamp: new Date(),
      });

      console.log(`[DraftsService] Commissioner override: pick ${pickId} changed from driver ${oldDriverId} to ${newDriverId}`);

      return { success: true, pick: updatedPick };
    } catch (error) {
      console.error('[DraftsService] Error overriding pick:', error);
      return { success: false, error: `Failed to override pick: ${error}` };
    }
  }

  /**
   * Commissioner override: Reassign a missed pick (no driver) to a driver
   * Used when player had no_pick resolution but commissioner wants to assign a driver
   */
  async commissionerAssignMissedPick(
    draftWindowId: string,
    leagueMemberId: string,
    round: number,
    driverId: string,
    commissionerUserId: string
  ): Promise<{ success: boolean; error?: string; pick?: any }> {
    try {
      // Get draft window with league
      const window = await this.prisma.draftWindow.findUnique({
        where: { id: draftWindowId },
        include: {
          league: {
            include: {
              members: {
                where: { leftAt: null },
                orderBy: { joinedAt: 'asc' },
              },
            },
          },
        },
      });

      if (!window) {
        return { success: false, error: 'Draft window not found' };
      }

      // Verify user is commissioner
      const commissioner = window.league.members[0];
      if (!commissioner || commissioner.userId !== commissionerUserId) {
        return { success: false, error: 'Only the commissioner can assign missed picks' };
      }

      // Check if member already has a pick in this round
      const existingPick = await this.prisma.draftPick.findFirst({
        where: {
          draftWindowId,
          leagueMemberId,
          round,
        },
      });

      if (existingPick) {
        // Use the override method instead
        return this.commissionerOverridePick(draftWindowId, existingPick.id, driverId, commissionerUserId);
      }

      // Verify driver is available
      const driver = await this.prisma.driver.findUnique({
        where: { id: driverId },
      });

      if (!driver) {
        return { success: false, error: 'Driver not found' };
      }

      const pickedDriver = await this.prisma.draftPick.findFirst({
        where: { draftWindowId, driverId },
      });

      if (pickedDriver) {
        return { success: false, error: 'Driver already picked by another member' };
      }

      // Get draft order for pick order
      const draftOrder = await this.getDraftOrder(draftWindowId);
      const memberOrder = draftOrder.find(o => o.leagueMemberId === leagueMemberId);
      const pickOrder = round === 1 ? memberOrder?.round1PickOrder : memberOrder?.round2PickOrder;

      // Create the pick
      const pick = await this.prisma.draftPick.create({
        data: {
          draftWindowId,
          leagueMemberId,
          driverId,
          round,
          pickOrder: pickOrder || 0,
          resolutionMethod: 'commissioner_override',
          submittedAt: new Date(),
        },
        include: {
          driver: true,
          leagueMember: true,
        },
      });

      // Create audit log
      await this.prisma.auditLog.create({
        data: {
          action: 'draft_pick_assigned',
          entityType: 'DraftPick',
          entityId: pick.id,
          userId: commissionerUserId,
          changes: { 
            oldValue: { hadNoPick: true }, 
            newValue: { driverId, driverCode: driver.code } 
          },
        },
      });

      console.log(`[DraftsService] Commissioner assigned driver ${driverId} to member ${leagueMemberId} for round ${round}`);

      return { success: true, pick };
    } catch (error) {
      console.error('[DraftsService] Error assigning missed pick:', error);
      return { success: false, error: `Failed to assign missed pick: ${error}` };
    }
  }

  /**
   * Get the next preferred driver for auto-draft
   * Returns the highest-ranked available driver
   */
  async getNextAutoDraftDriver(userId: string, draftWindowId: string): Promise<string | null> {
    // Get user's preferences
    const preferences = await this.prisma.autoDraftPreference.findMany({
      where: { userId },
      orderBy: { rank: 'asc' },
    });

    if (preferences.length === 0) {
      return null;
    }

    // Get already picked drivers
    const picks = await this.prisma.draftPick.findMany({
      where: { draftWindowId },
      select: { driverId: true },
    });
    const pickedDriverIds = new Set(picks.map(p => p.driverId));

    // Find first available driver from preferences
    for (const pref of preferences) {
      if (!pickedDriverIds.has(pref.driverId)) {
        return pref.driverId;
      }
    }

    return null; // All preferred drivers are taken
  }

  // ========== DRIVER SUBSTITUTION METHODS (US-014) ==========

  /**
   * Process a confirmed driver substitution after draft lock
   * Handles both auto_replace and redraft policies
   * @param substitutionId - The ID of the DriverSubstitution record
   */
  async processDriverSubstitution(substitutionId: string): Promise<{ success: boolean; error?: string; impacts?: SubstitutionImpact[] }> {
    try {
      // Get the substitution record
      const substitution = await this.prisma.driverSubstitution.findUnique({
        where: { id: substitutionId },
      });

      if (!substitution) {
        return { success: false, error: 'Substitution not found' };
      }

      if (!substitution.confirmedAt) {
        return { success: false, error: 'Substitution not yet confirmed by admin' };
      }

      // Find all draft windows for this race
      const draftWindows = await this.prisma.draftWindow.findMany({
        where: { raceId: substitution.raceId },
        include: {
          league: true,
          picks: {
            where: { driverId: substitution.originalDriverId },
            include: {
              driver: true,
              leagueMember: true,
            },
          },
        },
      });

      const impacts: SubstitutionImpact[] = [];

      for (const window of draftWindows) {
        // Check if draft window is locked (closed or completed)
        const isLocked = window.status === 'closed' || window.status === 'completed';
        const isOpen = window.status === 'open';

        for (const pick of window.picks) {
          const policy = window.league.substitutionPolicy as SubstitutionPolicy;
          
          if (isOpen) {
            // BEFORE draft closes: replacement added to pool, original unavailable
            // The original driver is already picked, so we just need to handle
            // if there's a replacement - add them to the available pool
            if (substitution.replacementDriverId) {
              // The replacement driver is now available for future picks
              // No action needed on existing picks - they stay valid
              console.log(`[DraftsService] Substitution before draft close - replacement ${substitution.replacementDriverId} available`);
            }
          } else if (isLocked) {
            // AFTER draft closes: handle based on league policy
            const impact: SubstitutionImpact = {
              draftWindowId: window.id,
              leagueId: window.leagueId,
              leagueMemberId: pick.leagueMemberId,
              teamName: pick.leagueMember?.teamName || '',
              userId: pick.leagueMember?.userId || '',
              affectedPickId: pick.id,
              round: pick.round,
              originalDriverId: substitution.originalDriverId,
              originalDriverCode: pick.driver?.code || '',
              substitutionId: substitution.id,
            };

            switch (policy) {
              case 'auto_replace':
                // Automatically assign replacement driver
                if (substitution.replacementDriverId) {
                  await this.autoReplaceDriver(pick.id, substitution.replacementDriverId, substitutionId);
                  impact.replacementDriverId = substitution.replacementDriverId;
                } else {
                  // No replacement (DNS) - player scores 0 for that slot
                  await this.markPickAsDNS(pick.id, substitutionId);
                }
                break;

              case 'redraft':
                // Give player 24h window to pick a new driver
                await this.createRedraftWindow(window.id, pick.leagueMemberId, substitution);
                break;

              case 'none':
                // No action - player keeps original driver (scores 0 if DNS)
                console.log(`[DraftsService] League ${window.leagueId} has no substitution policy - no action taken`);
                break;
            }

            impacts.push(impact);

            // Notify affected player
            await this.notifyPlayerOfSubstitution(
              pick.leagueMember?.userId || '',
              window.leagueId,
              substitution,
              policy
            );
          }
        }
      }

      // Create audit log
      await this.prisma.auditLog.create({
        data: {
          action: 'driver_substitution_processed',
          entityType: 'DriverSubstitution',
          entityId: substitutionId,
          changes: {
            raceId: substitution.raceId,
            originalDriverId: substitution.originalDriverId,
            replacementDriverId: substitution.replacementDriverId,
            affectedLeagues: impacts.length,
            impacts: impacts.map(i => ({ leagueId: i.leagueId, teamName: i.teamName })),
          },
        },
      });

      console.log(`[DraftsService] Processed substitution ${substitutionId}, affected ${impacts.length} picks`);

      return { success: true, impacts };
    } catch (error) {
      console.error('[DraftsService] Error processing substitution:', error);
      return { success: false, error: `Failed to process substitution: ${error}` };
    }
  }

  /**
   * Auto-replace a driver in a pick
   */
  private async autoReplaceDriver(pickId: string, replacementDriverId: string, substitutionId: string): Promise<void> {
    await this.prisma.draftPick.update({
      where: { id: pickId },
      data: {
        driverId: replacementDriverId,
        resolutionMethod: 'admin_substitution',
      },
    });

    console.log(`[DraftsService] Auto-replaced driver in pick ${pickId} with ${replacementDriverId}`);
  }

  /**
   * Mark a pick as DNS (no driver, will score 0)
   */
  private async markPickAsDNS(pickId: string, substitutionId: string): Promise<void> {
    // We keep the pick but note that the driver is DNS
    // The scoring engine will handle scoring 0 for DNS drivers
    await this.prisma.draftPick.update({
      where: { id: pickId },
      data: {
        resolutionMethod: 'admin_substitution',
      },
    });

    console.log(`[DraftsService] Marked pick ${pickId} as DNS - player will score 0`);
  }

  /**
   * Create a redraft window for a player
   * Gives them 24h to select a new driver
   */
  private async createRedraftWindow(
    draftWindowId: string,
    leagueMemberId: string,
    substitution: any
  ): Promise<void> {
    // Calculate expiry (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Store redraft window info in audit log (we'll query this for active redrafts)
    await this.prisma.auditLog.create({
      data: {
        action: 'redraft_window_created',
        entityType: 'DraftPick',
        entityId: `${draftWindowId}:${leagueMemberId}`,
        changes: {
          draftWindowId,
          leagueMemberId,
          originalDriverId: substitution.originalDriverId,
          replacementDriverId: substitution.replacementDriverId,
          substitutionId: substitution.id,
          redraftExpiresAt: expiresAt.toISOString(),
        },
      },
    });

    console.log(`[DraftsService] Created redraft window for member ${leagueMemberId}, expires ${expiresAt}`);
  }

  /**
   * Get active redraft windows for a user
   */
  async getActiveRedraftWindows(userId: string): Promise<RedraftWindow[]> {
    // Find league memberships for this user
    const memberships = await this.prisma.leagueMember.findMany({
      where: { userId, leftAt: null },
      select: { id: true },
    });
    const memberIds = memberships.map(m => m.id);

    // Find active redraft windows from audit logs
    const redraftLogs = await this.prisma.auditLog.findMany({
      where: {
        action: 'redraft_window_created',
        entityType: 'DraftPick',
      },
    });

    const now = new Date();
    const activeRedrafts: RedraftWindow[] = [];

    for (const log of redraftLogs) {
      const changes = log.changes as any;
      
      // Check if this redraft is for this user and still active
      if (!memberIds.includes(changes.leagueMemberId)) continue;
      
      const expiresAt = new Date(changes.redraftExpiresAt);
      if (expiresAt < now) continue;

      // Get available drivers (not already picked in this draft)
      const existingPicks = await this.prisma.draftPick.findMany({
        where: { draftWindowId: changes.draftWindowId },
        select: { driverId: true },
      });
      const pickedDriverIds = new Set(existingPicks.map(p => p.driverId));

      // Get the draft window to find the season
      const draftWindow = await this.prisma.draftWindow.findUnique({
        where: { id: changes.draftWindowId },
        include: { race: { include: { season: true } } },
      });

      if (!draftWindow) continue;

      // Get available drivers
      const allDrivers = await this.prisma.driver.findMany({
        where: { seasonId: draftWindow.race.seasonId },
      });

      const availableDrivers = allDrivers
        .filter(d => !pickedDriverIds.has(d.id) || d.id === changes.replacementDriverId)
        .map(d => ({
          id: d.id,
          code: d.code,
          name: `${d.givenName} ${d.familyName}`,
        }));

      activeRedrafts.push({
        leagueMemberId: changes.leagueMemberId,
        draftWindowId: changes.draftWindowId,
        originalDriverId: changes.originalDriverId,
        replacementDriverId: changes.replacementDriverId,
        redraftExpiresAt: expiresAt,
        availableDrivers,
      });
    }

    return activeRedrafts;
  }

  /**
   * Submit a redraft pick
   * Player selects a new driver after their original driver was substituted
   */
  async submitRedraftPick(
    substitutionId: string,
    leagueMemberId: string,
    newDriverId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Verify the league member belongs to this user
      const member = await this.prisma.leagueMember.findUnique({
        where: { id: leagueMemberId },
      });

      if (!member || member.userId !== userId) {
        return { success: false, error: 'Invalid league member' };
      }

      // Find the redraft window from audit logs
      const redraftLog = await this.prisma.auditLog.findFirst({
        where: {
          action: 'redraft_window_created',
          entityType: 'DraftPick',
          changes: {
            path: ['substitutionId'],
            equals: substitutionId,
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!redraftLog) {
        return { success: false, error: 'Redraft window not found' };
      }

      const changes = redraftLog.changes as any;

      // Verify this is the correct member
      if (changes.leagueMemberId !== leagueMemberId) {
        return { success: false, error: 'This redraft window is not for you' };
      }

      // Check if redraft window has expired
      const expiresAt = new Date(changes.redraftExpiresAt);
      if (expiresAt < new Date()) {
        return { success: false, error: 'Redraft window has expired' };
      }

      // Verify the driver is available
      const existingPick = await this.prisma.draftPick.findFirst({
        where: {
          draftWindowId: changes.draftWindowId,
          driverId: newDriverId,
        },
      });

      if (existingPick) {
        return { success: false, error: 'Driver already picked by another member' };
      }

      // Find the original pick
      const originalPick = await this.prisma.draftPick.findFirst({
        where: {
          draftWindowId: changes.draftWindowId,
          leagueMemberId,
          driverId: changes.originalDriverId,
        },
      });

      if (!originalPick) {
        return { success: false, error: 'Original pick not found' };
      }

      // Update the pick
      await this.prisma.draftPick.update({
        where: { id: originalPick.id },
        data: {
          driverId: newDriverId,
          resolutionMethod: 'driver_redraft',
        },
      });

      // Mark the redraft as completed
      await this.prisma.auditLog.create({
        data: {
          action: 'redraft_completed',
          entityType: 'DraftPick',
          entityId: originalPick.id,
          userId,
          changes: {
            substitutionId,
            originalDriverId: changes.originalDriverId,
            newDriverId,
          },
        },
      });

      // Broadcast update to league
      const draftWindow = await this.prisma.draftWindow.findUnique({
        where: { id: changes.draftWindowId },
      });
      
      if (draftWindow) {
        const newDriver = await this.prisma.driver.findUnique({
          where: { id: newDriverId },
        });

        this.broadcastToLeague(draftWindow.leagueId, {
          type: 'driver_redraft',
          payload: {
            leagueMemberId,
            teamName: member.teamName,
            oldDriverId: changes.originalDriverId,
            newDriverId,
            newDriverCode: newDriver?.code,
            newDriverName: newDriver ? `${newDriver.givenName} ${newDriver.familyName}` : '',
          },
          timestamp: new Date(),
        });
      }

      console.log(`[DraftsService] Redraft completed: member ${leagueMemberId} selected driver ${newDriverId}`);

      return { success: true };
    } catch (error) {
      console.error('[DraftsService] Error submitting redraft:', error);
      return { success: false, error: `Failed to submit redraft: ${error}` };
    }
  }

  /**
   * Notify a player of a driver substitution affecting their pick
   */
  private async notifyPlayerOfSubstitution(
    userId: string,
    leagueId: string,
    substitution: any,
    policy: SubstitutionPolicy
  ): Promise<void> {
    try {
      // Get driver details
      const originalDriver = await this.prisma.driver.findUnique({
        where: { id: substitution.originalDriverId },
      });

      let replacementDriver = null;
      if (substitution.replacementDriverId) {
        replacementDriver = await this.prisma.driver.findUnique({
          where: { id: substitution.replacementDriverId },
        });
      }

      let title: string;
      let body: string;
      let data: any = {
        leagueId,
        substitutionId: substitution.id,
        originalDriverId: substitution.originalDriverId,
        replacementDriverId: substitution.replacementDriverId,
      };

      if (replacementDriver) {
        title = 'Driver Substitution';
        if (policy === 'auto_replace') {
          body = `${originalDriver?.code || 'Your driver'} has been replaced by ${replacementDriver.code}. Your pick has been automatically updated.`;
        } else if (policy === 'redraft') {
          body = `${originalDriver?.code || 'Your driver'} has been replaced by ${replacementDriver.code}. You have 24 hours to select a different driver or keep the replacement.`;
          data.redraftRequired = true;
        } else {
          body = `${originalDriver?.code || 'Your driver'} has been replaced by ${replacementDriver.code}.`;
        }
      } else {
        title = 'Driver DNS (Did Not Start)';
        if (policy === 'redraft') {
          body = `${originalDriver?.code || 'Your driver'} will not start. You have 24 hours to select a replacement driver.`;
          data.redraftRequired = true;
        } else {
          body = `${originalDriver?.code || 'Your driver'} will not start. You will score 0 points for this driver.`;
        }
      }

      // Create notification
      await this.prisma.notification.create({
        data: {
          userId,
          type: 'driver_substitution',
          title,
          body,
          data,
        },
      });

      console.log(`[DraftsService] Notified user ${userId} of substitution`);
    } catch (error) {
      console.error('[DraftsService] Error notifying player:', error);
    }
  }

  /**
   * Get substitution impact for a specific draft window
   * Returns info about how a substitution affects this draft
   */
  async getSubstitutionImpactForDraft(
    draftWindowId: string,
    substitutionId: string
  ): Promise<{ affected: boolean; picks?: any[]; policy?: SubstitutionPolicy }> {
    const substitution = await this.prisma.driverSubstitution.findUnique({
      where: { id: substitutionId },
    });

    if (!substitution) {
      return { affected: false };
    }

    const draftWindow = await this.prisma.draftWindow.findUnique({
      where: { id: draftWindowId },
      include: {
        league: true,
        picks: {
          where: { driverId: substitution.originalDriverId },
          include: { driver: true, leagueMember: true },
        },
      },
    });

    if (!draftWindow || draftWindow.raceId !== substitution.raceId) {
      return { affected: false };
    }

    if (draftWindow.picks.length === 0) {
      return { affected: false };
    }

    return {
      affected: true,
      picks: draftWindow.picks,
      policy: draftWindow.league.substitutionPolicy as SubstitutionPolicy,
    };
  }
}

export default DraftsService;
