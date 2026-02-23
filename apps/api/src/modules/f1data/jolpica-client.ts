/**
 * Jolpica API Client
 * Base URL: https://api.jolpi.ca/ergast/f1/
 * Used for importing F1 season, race, and driver data
 */

import { PrismaClient } from '@prisma/client';

const JOLPICA_BASE_URL = 'https://api.jolpi.ca/ergast/f1';

export interface JolpicaSeason {
  season: string;
  url: string;
}

export interface JolpicaCircuit {
  circuitId: string;
  circuitName: string;
  Location: {
    lat: string;
    long: string;
    locality: string;
    country: string;
  };
}

export interface JolpicaRace {
  season: string;
  round: string;
  url: string;
  raceName: string;
  Circuit: JolpicaCircuit;
  date: string;
  time?: string;
  FirstPractice?: { date: string; time?: string };
  SecondPractice?: { date: string; time?: string };
  ThirdPractice?: { date: string; time?: string };
  Qualifying?: { date: string; time?: string };
  Sprint?: { date: string; time?: string };
}

export interface JolpicaDriver {
  driverId: string;
  permanentNumber?: string;
  code?: string;
  url: string;
  givenName: string;
  familyName: string;
  dateOfBirth: string;
  nationality: string;
}

export interface JolpicaRaceResult {
  number: string;
  position: string;
  positionText: string;
  points: string;
  Driver: JolpicaDriver;
  Constructor: {
    constructorId: string;
    name: string;
    nationality: string;
  };
  grid: string;
  laps: string;
  status: string;
  Time?: {
    millis: string;
    time: string;
  };
  FastestLap?: {
    rank: string;
    lap: string;
    Time: {
      time: string;
    };
    AverageSpeed: {
      units: string;
      speed: string;
    };
  };
}

export interface JolpicaResponse<T> {
  MRData: {
    xmlns: string;
    series: string;
    url: string;
    limit: string;
    offset: string;
    total: string;
    RaceTable?: {
      Races: JolpicaRace[];
    };
    DriverTable?: {
      Drivers: JolpicaDriver[];
    };
    SeasonTable?: {
      Seasons: JolpicaSeason[];
    };
    Race?: {
      Results: JolpicaRaceResult[];
    };
  };
}

export interface RaceResultSyncOutput {
  synced: number;
  errors: string[];
  discrepancies: Array<{
    raceResultId: string;
    field: string;
    jolpicaValue: unknown;
    adminValue: unknown;
  }>;
  raceId: string;
}

export class JolpicaClient {
  private baseUrl: string;
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient, baseUrl: string = JOLPICA_BASE_URL) {
    this.prisma = prisma;
    this.baseUrl = baseUrl;
  }

  /**
   * Fetch data from Jolpica API with error handling
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async fetch<T>(endpoint: string): Promise<T | null> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        // HTTP 4xx = no retry (except 429), HTTP 5xx = retry after 2 hours
        console.error(`Jolpica API error: ${response.status} ${response.statusText} for ${url}`);
        return null;
      }

      const data = await response.json() as T;
      return data;
    } catch (error) {
      console.error(`Jolpica API fetch error for ${endpoint}:`, error);
      return null;
    }
  }

  /**
   * Get all seasons from Jolpica
   */
  async getSeasons(): Promise<JolpicaSeason[]> {
    const response = await this.fetch<JolpicaResponse<JolpicaSeason>>('/seasons.json?limit=100');
    return response?.MRData?.SeasonTable?.Seasons || [];
  }

  /**
   * Get races for a specific season
   */
  async getRaces(seasonYear: number): Promise<JolpicaRace[]> {
    const response = await this.fetch<JolpicaResponse<JolpicaRace>>(`/${seasonYear}.json`);
    return response?.MRData?.RaceTable?.Races || [];
  }

  /**
   * Get drivers for a specific season
   */
  async getDrivers(seasonYear: number): Promise<JolpicaDriver[]> {
    const response = await this.fetch<JolpicaResponse<JolpicaDriver>>(`/${seasonYear}/drivers.json`);
    return response?.MRData?.DriverTable?.Drivers || [];
  }

  /**
   * Get race results for a specific race
   */
  async getRaceResults(seasonYear: number, round: number): Promise<JolpicaRaceResult[]> {
    const response = await this.fetch<JolpicaResponse<JolpicaRaceResult>>(`/${seasonYear}/${round}/results.json`);
    return response?.MRData?.Race?.Results || [];
  }

  /**
   * Sync season data to database
   */
  async syncSeason(year: number): Promise<{ seasonId: string; created: boolean }> {
    const existingSeason = await this.prisma.season.findUnique({
      where: { year }
    });

    if (existingSeason) {
      return { seasonId: existingSeason.id, created: false };
    }

    const season = await this.prisma.season.create({
      data: { year }
    });

    return { seasonId: season.id, created: true };
  }

  /**
   * Sync races for a season
   */
  async syncRaces(seasonYear: number): Promise<{ synced: number; errors: string[] }> {
    const errors: string[] = [];
    let synced = 0;

    // Ensure season exists
    const { seasonId } = await this.syncSeason(seasonYear);

    // Fetch races from Jolpica
    const races = await this.getRaces(seasonYear);

    for (const race of races) {
      try {
        const round = parseInt(race.round, 10);
        const raceDate = new Date(race.date);
        
        // Combine date and time if available
        if (race.time) {
          const [hours, minutes] = race.time.split(':');
          raceDate.setUTCHours(parseInt(hours, 10), parseInt(minutes, 10));
        }

        await this.prisma.race.upsert({
          where: {
            seasonId_round: {
              seasonId,
              round
            }
          },
          update: {
            raceName: race.raceName,
            circuitName: race.Circuit.circuitName,
            date: raceDate,
            time: race.time || null,
          },
          create: {
            seasonId,
            round,
            raceName: race.raceName,
            circuitName: race.Circuit.circuitName,
            date: raceDate,
            time: race.time || null,
          }
        });

        synced++;
      } catch (error) {
        errors.push(`Failed to sync race ${race.round} (${race.raceName}): ${error}`);
      }
    }

    return { synced, errors };
  }

  /**
   * Sync drivers for a season
   */
  async syncDrivers(seasonYear: number): Promise<{ synced: number; errors: string[] }> {
    const errors: string[] = [];
    let synced = 0;

    // Ensure season exists
    const { seasonId } = await this.syncSeason(seasonYear);

    // Fetch drivers from Jolpica
    const drivers = await this.getDrivers(seasonYear);

    for (const driver of drivers) {
      try {
        await this.prisma.driver.upsert({
          where: {
            seasonId_driverId: {
              seasonId,
              driverId: driver.driverId
            }
          },
          update: {
            permanentNumber: driver.permanentNumber ? parseInt(driver.permanentNumber, 10) : null,
            code: driver.code || driver.driverId.substring(0, 3).toUpperCase(),
            givenName: driver.givenName,
            familyName: driver.familyName,
            nationality: driver.nationality,
            dateOfBirth: new Date(driver.dateOfBirth),
          },
          create: {
            seasonId,
            driverId: driver.driverId,
            permanentNumber: driver.permanentNumber ? parseInt(driver.permanentNumber, 10) : null,
            code: driver.code || driver.driverId.substring(0, 3).toUpperCase(),
            givenName: driver.givenName,
            familyName: driver.familyName,
            nationality: driver.nationality,
            dateOfBirth: new Date(driver.dateOfBirth),
          }
        });

        synced++;
      } catch (error) {
        errors.push(`Failed to sync driver ${driver.driverId}: ${error}`);
      }
    }

    return { synced, errors };
  }

  /**
   * Sync race results for a specific race
   */
  async syncRaceResults(seasonYear: number, round: number): Promise<RaceResultSyncOutput> {
    const errors: string[] = [];
    const discrepancies: Array<{ raceResultId: string; field: string; jolpicaValue: unknown; adminValue: unknown }> = [];
    let synced = 0;
    let raceId = '';

    // Get the race
    const season = await this.prisma.season.findUnique({
      where: { year: seasonYear },
      include: {
        races: {
          where: { round }
        }
      }
    });

    if (!season || season.races.length === 0) {
      errors.push(`Race not found: ${seasonYear} round ${round}`);
      return { synced, errors, discrepancies, raceId };
    }

    const race = season.races[0];
    raceId = race.id;

    // Fetch results from Jolpica
    const results = await this.getRaceResults(seasonYear, round);

    for (const result of results) {
      try {
        // Find the driver
        const driver = await this.prisma.driver.findUnique({
          where: {
            seasonId_driverId: {
              seasonId: season.id,
              driverId: result.Driver.driverId
            }
          }
        });

        if (!driver) {
          errors.push(`Driver not found: ${result.Driver.driverId}`);
          continue;
        }

        // Check for existing result with admin protection
        const existingResult = await this.prisma.raceResult.findUnique({
          where: {
            raceId_driverId: {
              raceId: race.id,
              driverId: driver.id
            }
          }
        });

        // If admin protected, compare and log discrepancies
        if (existingResult?.adminProtected) {
          const jolpicaPosition = parseInt(result.position, 10);
          const jolpicaPoints = parseFloat(result.points);
          const jolpicaStatus = result.status;
          const jolpicaFastestLap = result.FastestLap?.rank === '1';
          
          // Check each field for discrepancies
          if (existingResult.position !== jolpicaPosition) {
            const discrepancy = await this.prisma.dataDiscrepancy.create({
              data: {
                raceResultId: existingResult.id,
                field: 'position',
                jolpicaValue: jolpicaPosition,
                adminValue: existingResult.position,
              }
            });
            discrepancies.push({
              raceResultId: discrepancy.raceResultId,
              field: 'position',
              jolpicaValue: jolpicaPosition,
              adminValue: existingResult.position,
            });
          }
          
          if (existingResult.points !== jolpicaPoints) {
            const discrepancy = await this.prisma.dataDiscrepancy.create({
              data: {
                raceResultId: existingResult.id,
                field: 'points',
                jolpicaValue: jolpicaPoints,
                adminValue: existingResult.points,
              }
            });
            discrepancies.push({
              raceResultId: discrepancy.raceResultId,
              field: 'points',
              jolpicaValue: jolpicaPoints,
              adminValue: existingResult.points,
            });
          }
          
          if (existingResult.status !== jolpicaStatus) {
            const discrepancy = await this.prisma.dataDiscrepancy.create({
              data: {
                raceResultId: existingResult.id,
                field: 'status',
                jolpicaValue: jolpicaStatus,
                adminValue: existingResult.status,
              }
            });
            discrepancies.push({
              raceResultId: discrepancy.raceResultId,
              field: 'status',
              jolpicaValue: jolpicaStatus,
              adminValue: existingResult.status,
            });
          }
          
          if (existingResult.fastestLap !== jolpicaFastestLap) {
            const discrepancy = await this.prisma.dataDiscrepancy.create({
              data: {
                raceResultId: existingResult.id,
                field: 'fastestLap',
                jolpicaValue: jolpicaFastestLap,
                adminValue: existingResult.fastestLap,
              }
            });
            discrepancies.push({
              raceResultId: discrepancy.raceResultId,
              field: 'fastestLap',
              jolpicaValue: jolpicaFastestLap,
              adminValue: existingResult.fastestLap,
            });
          }
          
          continue;
        }

        // Upsert race result
        await this.prisma.raceResult.upsert({
          where: {
            raceId_driverId: {
              raceId: race.id,
              driverId: driver.id
            }
          },
          update: {
            position: parseInt(result.position, 10),
            points: parseFloat(result.points),
            status: result.status,
            time: result.Time?.time || null,
            fastestLap: result.FastestLap?.rank === '1',
            jolpicaValue: JSON.parse(JSON.stringify(result)),
          },
          create: {
            raceId: race.id,
            driverId: driver.id,
            position: parseInt(result.position, 10),
            points: parseFloat(result.points),
            status: result.status,
            time: result.Time?.time || null,
            fastestLap: result.FastestLap?.rank === '1',
            jolpicaValue: JSON.parse(JSON.stringify(result)),
          }
        });

        synced++;
      } catch (error) {
        errors.push(`Failed to sync result for ${result.Driver.driverId}: ${error}`);
      }
    }

    return { synced, errors, discrepancies, raceId };
  }
}

export default JolpicaClient;