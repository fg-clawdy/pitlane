/**
 * F1 Data Service
 * Handles synchronization of F1 data from Jolpica API
 */

import { PrismaClient } from '@prisma/client';
import JolpicaClient, { RaceResultSyncOutput } from './jolpica-client';

export interface SyncResult {
  seasonId?: string;
  racesSynced: number;
  driversSynced: number;
  teamsSynced: number;
  errors: string[];
}

export interface RaceResultSyncResult {
  resultsSynced: number;
  errors: string[];
  needsRetry: boolean;
  discrepancies: RaceResultSyncOutput['discrepancies'];
  raceId: string;
}

export class F1DataService {
  private prisma: PrismaClient;
  private jolpica: JolpicaClient;

  // Configuration from system settings (defaults)
  private pollStartHoursAfterRace: number = 3;
  private pollIntervalHours: number = 2;
  private maxPolls: number = 18;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.jolpica = new JolpicaClient(prisma);
  }

  /**
   * Load system settings for polling configuration
   */
  private async loadSettings(): Promise<void> {
    const settings = await this.prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            'jolpica_poll_start_hours_after_race',
            'jolpica_poll_interval_hours',
            'jolpica_max_polls'
          ]
        }
      }
    });

    for (const setting of settings) {
      switch (setting.key) {
        case 'jolpica_poll_start_hours_after_race':
          this.pollStartHoursAfterRace = (setting.value as { value: number }).value;
          break;
        case 'jolpica_poll_interval_hours':
          this.pollIntervalHours = (setting.value as { value: number }).value;
          break;
        case 'jolpica_max_polls':
          this.maxPolls = (setting.value as { value: number }).value;
          break;
      }
    }
  }

  /**
   * Get current F1 season year
   */
  getCurrentSeasonYear(): number {
    const now = new Date();
    // F1 season typically runs March-December
    // If we're in Jan-Feb, we're still in the previous year's season
    if (now.getMonth() < 2) {
      return now.getFullYear() - 1;
    }
    return now.getFullYear();
  }

  /**
   * Get the most recent active season year from database
   * Falls back to previous years if current year doesn't exist
   */
  async getActiveSeasonYear(): Promise<number> {
    const currentYear = this.getCurrentSeasonYear();
    
    // Check if current year exists in database
    const currentSeason = await this.prisma.season.findUnique({
      where: { year: currentYear }
    });
    
    if (currentSeason) {
      return currentYear;
    }
    
    // Fall back to the most recent season in the database
    const mostRecentSeason = await this.prisma.season.findFirst({
      orderBy: { year: 'desc' }
    });
    
    if (mostRecentSeason) {
      console.log(`[F1DataService] Current year ${currentYear} not found, using ${mostRecentSeason.year}`);
      return mostRecentSeason.year;
    }
    
    // No seasons in database, return current year (will be created by sync)
    return currentYear;
  }

  /**
   * Sync current season data (races and drivers)
   * Called on app startup
   * Falls back to previous year if current year has no data
   */
  async syncCurrentSeason(): Promise<SyncResult> {
    const result: SyncResult = {
      racesSynced: 0,
      driversSynced: 0,
      teamsSynced: 0,
      errors: []
    };

    const currentYear = this.getCurrentSeasonYear();
    
    // Try current year first, then fallback to previous years
    const yearsToTry = [currentYear, currentYear - 1, currentYear - 2];
    
    for (const seasonYear of yearsToTry) {
      try {
        console.log(`[F1DataService] Attempting to sync season ${seasonYear}...`);

        // Sync season
        const seasonResult = await this.jolpica.syncSeason(seasonYear);
        result.seasonId = seasonResult.seasonId;

        // Sync races
        const racesResult = await this.jolpica.syncRaces(seasonYear);
        
        // If no races were synced, this season likely doesn't exist yet
        if (racesResult.synced === 0) {
          console.log(`[F1DataService] No races found for ${seasonYear}, trying previous year...`);
          continue;
        }
        
        result.racesSynced = racesResult.synced;
        result.errors.push(...racesResult.errors);

        // Sync drivers
        const driversResult = await this.jolpica.syncDrivers(seasonYear);
        result.driversSynced = driversResult.synced;
        result.errors.push(...driversResult.errors);

        // Sync teams
        const teamsResult = await this.jolpica.syncTeams(seasonYear);
        result.teamsSynced = teamsResult.synced;
        result.errors.push(...teamsResult.errors);

        console.log(`[F1DataService] Successfully synced season ${seasonYear}: ${result.racesSynced} races, ${result.driversSynced} drivers, ${result.teamsSynced} teams`);
        return result;
      } catch (error) {
        console.warn(`[F1DataService] Failed to sync season ${seasonYear}: ${error}`);
        result.errors.push(`Season ${seasonYear} sync failed: ${error}`);
      }
    }

    // If we get here, all years failed
    result.errors.push(`Failed to sync any season data. Tried years: ${yearsToTry.join(', ')}`);
    console.error(`[F1DataService] Failed to sync any season data`);
    
    return result;
  }

  /**
   * Sync a specific season by year
   */
  async syncSeason(year: number): Promise<SyncResult> {
    const result: SyncResult = {
      racesSynced: 0,
      driversSynced: 0,
      teamsSynced: 0,
      errors: []
    };

    try {
      // Sync season
      const seasonResult = await this.jolpica.syncSeason(year);
      result.seasonId = seasonResult.seasonId;

      // Sync races
      const racesResult = await this.jolpica.syncRaces(year);
      result.racesSynced = racesResult.synced;
      result.errors.push(...racesResult.errors);

      // Sync drivers
      const driversResult = await this.jolpica.syncDrivers(year);
      result.driversSynced = driversResult.synced;
      result.errors.push(...driversResult.errors);

      // Sync teams
      const teamsResult = await this.jolpica.syncTeams(year);
      result.teamsSynced = teamsResult.synced;
      result.errors.push(...teamsResult.errors);
    } catch (error) {
      result.errors.push(`Season ${year} sync failed: ${error}`);
    }

    return result;
  }

  /**
   * Check if polling is needed for a race
   * Returns true if race started 3+ hours ago and results not yet synced
   */
  async shouldPollRaceResults(raceId: string): Promise<boolean> {
    await this.loadSettings();

    const race = await this.prisma.race.findUnique({
      where: { id: raceId },
      include: {
        results: true
      }
    });

    if (!race) return false;

    // Check if results already exist
    if (race.results.length > 0) return false;

    // Calculate race start time
    const raceStart = new Date(race.date);
    if (race.time) {
      const [hours, minutes] = race.time.split(':');
      raceStart.setUTCHours(parseInt(hours, 10), parseInt(minutes, 10));
    }

    // Check if enough time has passed since race start
    const now = new Date();
    const hoursSinceRaceStart = (now.getTime() - raceStart.getTime()) / (1000 * 60 * 60);

    return hoursSinceRaceStart >= this.pollStartHoursAfterRace;
  }

  /**
   * Poll for race results with retry logic
   * Returns true if results were successfully synced
   */
  async pollRaceResults(seasonYear: number, round: number, attemptNumber: number = 1): Promise<RaceResultSyncResult> {
    await this.loadSettings();

    const result: RaceResultSyncResult = {
      resultsSynced: 0,
      errors: [],
      needsRetry: false,
      discrepancies: [],
      raceId: ''
    };

    try {
      // Try to sync results
      const syncResult = await this.jolpica.syncRaceResults(seasonYear, round);
      result.resultsSynced = syncResult.synced;
      result.errors.push(...syncResult.errors);
      result.discrepancies = syncResult.discrepancies;
      result.raceId = syncResult.raceId;

      // If no results synced and we haven't exhausted attempts, mark for retry
      if (syncResult.synced === 0 && attemptNumber < this.maxPolls) {
        result.needsRetry = true;
        console.log(`[F1DataService] Race results poll attempt ${attemptNumber} returned no results. Will retry in ${this.pollIntervalHours} hours.`);
      } else if (syncResult.synced === 0 && attemptNumber >= this.maxPolls) {
        // Max attempts reached - trigger admin alert
        await this.triggerAdminAlert(seasonYear, round, attemptNumber);
        result.errors.push(`Max polling attempts (${this.maxPolls}) reached without results`);
      }
      
      // If we have discrepancies, notify commissioners
      if (syncResult.discrepancies.length > 0) {
        await this.notifyCommissionersOfDiscrepancies(syncResult.raceId, syncResult.discrepancies);
      }
    } catch (error) {
      result.errors.push(`Race results poll failed: ${error}`);
      result.needsRetry = attemptNumber < this.maxPolls;
    }

    return result;
  }

  /**
   * Notify league commissioners of data discrepancies
   */
  private async notifyCommissionersOfDiscrepancies(
    raceId: string,
    discrepancies: RaceResultSyncOutput['discrepancies']
  ): Promise<void> {
    try {
      // Get the race with season info
      const race = await this.prisma.race.findUnique({
        where: { id: raceId },
        include: { season: true }
      });

      if (!race) return;

      // Find all leagues for this season
      const leagues = await this.prisma.league.findMany({
        where: { seasonId: race.seasonId },
        include: {
          members: {
            where: { league: { /* commissioners are league creators for now */ } }
          }
        }
      });

      // Get unique commissioner user IDs (league creators)
      const commissionerUserIds = new Set<string>();
      for (const league of leagues) {
        // Find the league creator (first member or use audit log)
        const firstMember = await this.prisma.leagueMember.findFirst({
          where: { leagueId: league.id },
          orderBy: { joinedAt: 'asc' }
        });
        if (firstMember) {
          commissionerUserIds.add(firstMember.userId);
        }
      }

      // Create notifications for each commissioner
      for (const userId of commissionerUserIds) {
        await this.prisma.notification.create({
          data: {
            userId,
            type: 'data_discrepancy',
            title: 'Race Data Discrepancy Detected',
            body: `${discrepancies.length} data discrepancy(ies) detected for ${race.raceName}. Jolpica data differs from admin-entered values.`,
            data: {
              raceId,
              raceName: race.raceName,
              discrepancyCount: discrepancies.length,
              fields: discrepancies.map(d => d.field)
            }
          }
        });
      }

      console.log(`[F1DataService] Notified ${commissionerUserIds.size} commissioners of ${discrepancies.length} discrepancies for race ${race.raceName}`);
    } catch (error) {
      console.error(`[F1DataService] Failed to notify commissioners: ${error}`);
    }
  }

  /**
   * Trigger admin alert for failed race result import
   */
  private async triggerAdminAlert(seasonYear: number, round: number, attempts: number): Promise<void> {
    try {
      // Create an audit log entry for admin attention
      await this.prisma.auditLog.create({
        data: {
          action: 'jolpica_poll_failed',
          entityType: 'race',
          entityId: `${seasonYear}-${round}`,
          changes: {
            seasonYear,
            round,
            attempts,
            timestamp: new Date().toISOString(),
            message: `Failed to import race results after ${attempts} polling attempts`
          }
        }
      });

      console.error(`[F1DataService] ADMIN ALERT: Failed to import results for ${seasonYear} round ${round} after ${attempts} attempts`);
    } catch (error) {
      console.error(`[F1DataService] Failed to create admin alert: ${error}`);
    }
  }

  /**
   * Get upcoming races that need result polling
   */
  async getRacesNeedingPolling(): Promise<Array<{ id: string; seasonYear: number; round: number }>> {
    await this.loadSettings();

    const now = new Date();
    const cutoffTime = new Date(now.getTime() - (this.pollStartHoursAfterRace * 60 * 60 * 1000));

    // Find races that have started but have no results
    const races = await this.prisma.race.findMany({
      where: {
        date: {
          lte: cutoffTime
        },
        results: {
          none: {}
        }
      },
      include: {
        season: true
      }
    });

    return races.map(race => ({
      id: race.id,
      seasonYear: race.season.year,
      round: race.round
    }));
  }

  /**
   * Get all seasons
   */
  async getSeasons() {
    return this.prisma.season.findMany({
      orderBy: { year: 'desc' },
      include: {
        races: {
          orderBy: { round: 'asc' }
        }
      }
    });
  }

  /**
   * Get races for a season
   */
  async getRaces(seasonYear: number) {
    const season = await this.prisma.season.findUnique({
      where: { year: seasonYear },
      include: {
        races: {
          orderBy: { round: 'asc' }
        }
      }
    });

    return season?.races || [];
  }

  /**
   * Get a specific race
   */
  async getRace(seasonYear: number, round: number) {
    const season = await this.prisma.season.findUnique({
      where: { year: seasonYear }
    });

    if (!season) return null;

    return this.prisma.race.findUnique({
      where: {
        seasonId_round: {
          seasonId: season.id,
          round
        }
      }
    });
  }

  /**
   * Get drivers for a season
   */
  async getDrivers(seasonYear: number) {
    const season = await this.prisma.season.findUnique({
      where: { year: seasonYear },
      include: {
        drivers: {
          orderBy: { familyName: 'asc' }
        }
      }
    });

    return season?.drivers || [];
  }

  /**
   * Get teams for a season
   */
  async getTeams(seasonYear: number) {
    const season = await this.prisma.season.findUnique({
      where: { year: seasonYear },
      include: {
        teams: {
          orderBy: { name: 'asc' }
        }
      }
    });

    return season?.teams || [];
  }

  /**
   * Get all teams (constructors) across all seasons
   */
  async getAllTeams() {
    // @ts-ignore - teams relation will exist after prisma generate
    return this.prisma.team.findMany({
      orderBy: { name: 'asc' }
    });
  }

  /**
   * Get race results for a specific race
   */
  async getRaceResults(seasonYear: number, round: number) {
    const season = await this.prisma.season.findUnique({
      where: { year: seasonYear }
    });

    if (!season) return [];

    const race = await this.prisma.race.findUnique({
      where: {
        seasonId_round: {
          seasonId: season.id,
          round
        }
      },
      include: {
        results: {
          include: {
            driver: {
              select: {
                id: true,
                driverId: true,
                code: true,
                givenName: true,
                familyName: true,
                permanentNumber: true,
                nationality: true
              }
            }
          },
          orderBy: { position: 'asc' }
        }
      }
    });

    return race?.results || [];
  }

  // ========== ADMIN DATA OVERRIDE METHODS ==========

  /**
   * Override a race result field with admin value
   * @param resultId - The race result ID to override
   * @param field - The field to override (position, points, status, time, fastestLap)
   * @param adminValue - The admin-provided value
   * @param adminProtected - Whether to protect from future Jolpica overwrites
   * @param adminUserId - The admin user performing the action
   */
  async overrideRaceResult(
    resultId: string,
    field: string,
    adminValue: any,
    adminProtected: boolean,
    adminUserId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get current race result with jolpica value
      const result = await this.prisma.raceResult.findUnique({
        where: { id: resultId },
        include: { race: { include: { season: true } }, driver: true }
      });

      if (!result) {
        return { success: false, error: 'Race result not found' };
      }

      // Get the current Jolpica value for this field
      const currentJolpicaValue = (result.jolpicaValue as any)?.[field];

      // If field value is changing, create a discrepancy record
      if (currentJolpicaValue !== undefined && currentJolpicaValue !== adminValue) {
        await this.prisma.dataDiscrepancy.create({
          data: {
            raceResultId: resultId,
            field,
            jolpicaValue: currentJolpicaValue,
            adminValue
          }
        });
      }

      // Build the admin value JSON
      const currentAdminValue = (result.adminValue as any) || {};
      const updatedAdminValue = {
        ...currentAdminValue,
        [field]: adminValue
      };

      // Update the race result
      await this.prisma.raceResult.update({
        where: { id: resultId },
        data: {
          adminValue: updatedAdminValue,
          adminProtected,
          // Update the actual field if protected
          ...(adminProtected && this.getFieldUpdateObject(field, adminValue))
        }
      });

      // Create audit log
      await this.prisma.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'race_result_override',
          entityType: 'RaceResult',
          entityId: resultId,
          changes: {
            field,
            previousValue: currentJolpicaValue,
            newValue: adminValue,
            adminProtected,
            raceName: result.race.raceName,
            driver: `${result.driver.givenName} ${result.driver.familyName}`
          }
        }
      });

      // Trigger score recalculation
      await this.triggerScoreRecalculation(result.raceId);

      // Notify commissioners
      await this.notifyCommissionersOfOverride(result.race, field, adminValue);

      return { success: true };
    } catch (error) {
      console.error('[F1DataService] Override failed:', error);
      return { success: false, error: `Override failed: ${error}` };
    }
  }

  /**
   * Get field update object based on field name
   */
  private getFieldUpdateObject(field: string, value: any): any {
    switch (field) {
      case 'position':
        return { position: value };
      case 'points':
        return { points: value };
      case 'status':
        return { status: value };
      case 'time':
        return { time: value };
      case 'fastestLap':
        return { fastestLap: value };
      default:
        return {};
    }
  }

  /**
   * Create a driver substitution
   * @param raceId - The race ID
   * @param originalDriverId - The original driver ID
   * @param replacementDriverId - The replacement driver ID (null if DNS)
   * @param reason - Reason for substitution
   * @param adminUserId - The admin user performing the action
   */
  async createDriverSubstitution(
    raceId: string,
    originalDriverId: string,
    replacementDriverId: string | null,
    reason: string,
    adminUserId: string
  ): Promise<{ success: boolean; error?: string; substitutionId?: string }> {
    try {
      const race = await this.prisma.race.findUnique({
        where: { id: raceId },
        include: { season: true }
      });

      if (!race) {
        return { success: false, error: 'Race not found' };
      }

      const originalDriver = await this.prisma.driver.findUnique({
        where: { id: originalDriverId }
      });

      if (!originalDriver) {
        return { success: false, error: 'Original driver not found' };
      }

      let replacementDriver = null;
      if (replacementDriverId) {
        replacementDriver = await this.prisma.driver.findUnique({
          where: { id: replacementDriverId }
        });
      }

      // Create substitution record
      const substitution = await this.prisma.driverSubstitution.create({
        data: {
          raceId,
          originalDriverId,
          replacementDriverId,
          reason,
          confirmedAt: new Date()
        }
      });

      // Create audit log
      await this.prisma.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'driver_substitution_create',
          entityType: 'DriverSubstitution',
          entityId: substitution.id,
          changes: {
            raceId,
            raceName: race.raceName,
            originalDriver: `${originalDriver.givenName} ${originalDriver.familyName}`,
            replacementDriver: replacementDriver ? `${replacementDriver.givenName} ${replacementDriver.familyName}` : 'DNS (no substitute)',
            reason
          }
        }
      });

      // If there's a replacement driver, update draft picks if needed
      if (replacementDriverId) {
        await this.updateDraftPicksForSubstitution(raceId, originalDriverId, replacementDriverId);
      }

      // Trigger score recalculation
      await this.triggerScoreRecalculation(raceId);

      return { success: true, substitutionId: substitution.id };
    } catch (error) {
      console.error('[F1DataService] Driver substitution failed:', error);
      return { success: false, error: `Substitution failed: ${error}` };
    }
  }

  /**
   * Update draft picks when a driver is substituted
   */
  private async updateDraftPicksForSubstitution(
    raceId: string,
    originalDriverId: string,
    replacementDriverId: string
  ): Promise<void> {
    // Find draft windows for this race
    const draftWindows = await this.prisma.draftWindow.findMany({
      where: { raceId }
    });

    for (const window of draftWindows) {
      // Update any picks that used the original driver
      await this.prisma.draftPick.updateMany({
        where: {
          draftWindowId: window.id,
          driverId: originalDriverId
        },
        data: {
          driverId: replacementDriverId,
          resolutionMethod: 'admin_substitution'
        }
      });
    }
  }

  /**
   * Trigger score recalculation for a race
   */
  async triggerScoreRecalculation(raceId: string): Promise<void> {
    try {
      // Get the scoring service
      const { ScoringService } = await import('../scoring/scoring.service.js');
      const scoringService = new ScoringService(this.prisma);
      
      // Get all leagues for this race
      const draftWindows = await this.prisma.draftWindow.findMany({
        where: { raceId },
        select: { leagueId: true }
      });

      const leagueIds = [...new Set(draftWindows.map(dw => dw.leagueId))];

      // Recalculate scores for each league
      for (const leagueId of leagueIds) {
        await scoringService.calculateRaceScores(leagueId, raceId);
      }

      console.log(`[F1DataService] Recalculated scores for race ${raceId} in ${leagueIds.length} leagues`);
    } catch (error) {
      console.error('[F1DataService] Score recalculation failed:', error);
    }
  }

  /**
   * Notify commissioners of admin data override
   */
  private async notifyCommissionersOfOverride(
    race: any,
    field: string,
    newValue: any
  ): Promise<void> {
    try {
      // Find all leagues for this season
      const leagues = await this.prisma.league.findMany({
        where: { seasonId: race.seasonId }
      });

      // Get unique commissioner user IDs
      const commissionerUserIds = new Set<string>();
      for (const league of leagues) {
        const firstMember = await this.prisma.leagueMember.findFirst({
          where: { leagueId: league.id },
          orderBy: { joinedAt: 'asc' }
        });
        if (firstMember) {
          commissionerUserIds.add(firstMember.userId);
        }
      }

      // Create notifications
      for (const userId of commissionerUserIds) {
        await this.prisma.notification.create({
          data: {
            userId,
            type: 'data_discrepancy',
            title: 'Race Data Overridden by Admin',
            body: `Admin has overridden ${field} for ${race.raceName}. New value: ${newValue}. This may affect league scores.`,
            data: {
              raceId: race.id,
              raceName: race.raceName,
              field,
              newValue
            }
          }
        });
      }
    } catch (error) {
      console.error('[F1DataService] Failed to notify commissioners:', error);
    }
  }

  /**
   * Get admin override data for a race result
   */
  async getAdminOverrideData(resultId: string): Promise<any> {
    const result = await this.prisma.raceResult.findUnique({
      where: { id: resultId },
      include: {
        driver: true,
        race: true,
        discrepancies: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!result) return null;

    return {
      resultId: result.id,
      raceName: result.race.raceName,
      driver: `${result.driver.givenName} ${result.driver.familyName}`,
      driverCode: result.driver.code,
      currentPosition: result.position,
      currentPoints: result.points,
      currentStatus: result.status,
      currentTime: result.time,
      currentFastestLap: result.fastestLap,
      jolpicaValue: result.jolpicaValue,
      adminValue: result.adminValue,
      adminProtected: result.adminProtected,
      discrepancies: result.discrepancies
    };
  }

  /**
   * List all admin overrides for a race
   */
  async listRaceOverrides(raceId: string): Promise<any[]> {
    const results = await this.prisma.raceResult.findMany({
      where: { raceId },
      include: {
        driver: true,
        discrepancies: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    return results.map(result => ({
      resultId: result.id,
      driver: `${result.driver.givenName} ${result.driver.familyName}`,
      driverCode: result.driver.code,
      position: result.position,
      points: result.points,
      status: result.status,
      adminProtected: result.adminProtected,
      adminValue: result.adminValue,
      hasDiscrepancies: result.discrepancies.length > 0,
      discrepancyCount: result.discrepancies.length
    }));
  }

  /**
   * Resolve a data discrepancy
   */
  async resolveDiscrepancy(
    discrepancyId: string,
    resolution: 'accepted' | 'rejected',
    adminUserId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const discrepancy = await this.prisma.dataDiscrepancy.findUnique({
        where: { id: discrepancyId }
      });

      if (!discrepancy) {
        return { success: false, error: 'Discrepancy not found' };
      }

      // Update the discrepancy record
      await this.prisma.dataDiscrepancy.update({
        where: { id: discrepancyId },
        data: { resolvedAt: new Date() }
      });

      // If accepted, update the race result to match admin value
      if (resolution === 'accepted' && discrepancy.adminValue !== undefined) {
        const result = await this.prisma.raceResult.findUnique({
          where: { id: discrepancy.raceResultId }
        });

        if (result) {
          const adminVal = discrepancy.adminValue as any;
          await this.prisma.raceResult.update({
            where: { id: discrepancy.raceResultId },
            data: this.getFieldUpdateObject(discrepancy.field, adminVal)
          });

          // Trigger recalculation
          await this.triggerScoreRecalculation(result.raceId);
        }
      }

      // Create audit log
      await this.prisma.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'discrepancy_resolved',
          entityType: 'DataDiscrepancy',
          entityId: discrepancyId,
          changes: {
            field: discrepancy.field,
            resolution,
            previousJolpicaValue: discrepancy.jolpicaValue,
            adminValue: discrepancy.adminValue
          }
        }
      });

      return { success: true };
    } catch (error) {
      console.error('[F1DataService] Discrepancy resolution failed:', error);
      return { success: false, error: `Resolution failed: ${error}` };
    }
  }
}

export default F1DataService;
