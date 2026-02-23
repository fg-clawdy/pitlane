/**
 * F1 Data Service
 * Handles synchronization of F1 data from Jolpica API
 */

import { PrismaClient } from '@prisma/client';
import JolpicaClient from './jolpica-client';

export interface SyncResult {
  seasonId?: string;
  racesSynced: number;
  driversSynced: number;
  errors: string[];
}

export interface RaceResultSyncResult {
  resultsSynced: number;
  errors: string[];
  needsRetry: boolean;
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
   * Sync current season data (races and drivers)
   * Called on app startup
   */
  async syncCurrentSeason(): Promise<SyncResult> {
    const result: SyncResult = {
      racesSynced: 0,
      driversSynced: 0,
      errors: []
    };

    try {
      const seasonYear = this.getCurrentSeasonYear();

      // Sync season
      const seasonResult = await this.jolpica.syncSeason(seasonYear);
      result.seasonId = seasonResult.seasonId;

      // Sync races
      const racesResult = await this.jolpica.syncRaces(seasonYear);
      result.racesSynced = racesResult.synced;
      result.errors.push(...racesResult.errors);

      // Sync drivers
      const driversResult = await this.jolpica.syncDrivers(seasonYear);
      result.driversSynced = driversResult.synced;
      result.errors.push(...driversResult.errors);

      console.log(`[F1DataService] Synced season ${seasonYear}: ${result.racesSynced} races, ${result.driversSynced} drivers`);
    } catch (error) {
      result.errors.push(`Season sync failed: ${error}`);
    }

    return result;
  }

  /**
   * Sync a specific season by year
   */
  async syncSeason(year: number): Promise<SyncResult> {
    const result: SyncResult = {
      racesSynced: 0,
      driversSynced: 0,
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
      needsRetry: false
    };

    try {
      // Try to sync results
      const syncResult = await this.jolpica.syncRaceResults(seasonYear, round);
      result.resultsSynced = syncResult.synced;
      result.errors.push(...syncResult.errors);

      // If no results synced and we haven't exhausted attempts, mark for retry
      if (syncResult.synced === 0 && attemptNumber < this.maxPolls) {
        result.needsRetry = true;
        console.log(`[F1DataService] Race results poll attempt ${attemptNumber} returned no results. Will retry in ${this.pollIntervalHours} hours.`);
      } else if (syncResult.synced === 0 && attemptNumber >= this.maxPolls) {
        // Max attempts reached - trigger admin alert
        await this.triggerAdminAlert(seasonYear, round, attemptNumber);
        result.errors.push(`Max polling attempts (${this.maxPolls}) reached without results`);
      }
    } catch (error) {
      result.errors.push(`Race results poll failed: ${error}`);
      result.needsRetry = attemptNumber < this.maxPolls;
    }

    return result;
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
}

export default F1DataService;