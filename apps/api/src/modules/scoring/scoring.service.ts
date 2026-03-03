/**
 * Scoring Service
 * Handles race score calculations for all scoring systems
 */

import { PrismaClient } from '@prisma/client';
import {
  ScoringType,
  FinishStatus,
  DriverScore,
  PlayerRaceScore,
  RaceScoreResult,
  ScoringConfig,
  SCORING_CONFIGS,
  StandingsEntry,
  SeasonPodium,
  WeeklyWinner,
  LeagueStandingsView,
  MemberRaceHistory,
  CurrentWeekDraftStatus,
  LeagueDriverStanding,
} from './types';

export class ScoringService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Calculate score for a single driver based on race result
   */
  calculateDriverScore(
    position: number | null,
    status: string,
    fastestLap: boolean,
    scoringType: ScoringType
  ): number {
    const config = SCORING_CONFIGS[scoringType];

    // Handle non-finish statuses
    const normalizedStatus = this.normalizeStatus(status);
    
    if (normalizedStatus === 'DNF' || normalizedStatus === 'DNS' || normalizedStatus === 'DSQ') {
      return config.dnfScore; // All non-finish statuses score 0
    }

    // No position means no score
    if (position === null || position === undefined) {
      return config.noDriverScore;
    }

    // Get base points from scoring table
    const basePoints = config.table[position] ?? 0;

    // Add fastest lap bonus if applicable
    let fastestLapBonus = 0;
    if (fastestLap && config.fastestLapBonus > 0) {
      // For FIA scoring, fastest lap only counts if driver finishes in top 10
      if (config.fastestLapRequiresTop10) {
        if (position <= 10) {
          fastestLapBonus = config.fastestLapBonus;
        }
      } else {
        fastestLapBonus = config.fastestLapBonus;
      }
    }

    return basePoints + fastestLapBonus;
  }

  /**
   * Normalize finish status to standard values
   */
  private normalizeStatus(status: string): FinishStatus {
    const upperStatus = status.toUpperCase();
    
    if (upperStatus === 'FINISHED' || upperStatus === '+1 LAP' || upperStatus === '+2 LAPS' || upperStatus.includes('LAP')) {
      return 'Finished';
    }
    if (upperStatus === 'DNF' || upperStatus.includes('RETIRED') || upperStatus.includes('ACCIDENT') || upperStatus.includes('COLLISION')) {
      return 'DNF';
    }
    if (upperStatus === 'DNS' || upperStatus === 'DID NOT START') {
      return 'DNS';
    }
    if (upperStatus === 'DSQ' || upperStatus === 'DISQUALIFIED') {
      return 'DSQ';
    }
    return 'Other';
  }

  /**
   * Calculate scores for all players in a league for a specific race
   */
  async calculateRaceScores(leagueId: string, raceId: string): Promise<RaceScoreResult> {
    const result: RaceScoreResult = {
      raceId,
      leagueId,
      scores: [],
      weeklyWinnerIds: [],
      errors: [],
    };

    try {
      // Get league with scoring type
      const league = await this.prisma.league.findUnique({
        where: { id: leagueId },
        include: {
          members: {
            where: { leftAt: null },
            include: {
              draftPicks: {
                where: {
                  draftWindow: { raceId },
                },
              },
            },
          },
        },
      });

      if (!league) {
        result.errors.push(`League ${leagueId} not found`);
        return result;
      }

      const scoringType = league.scoringType as ScoringType;

      // Get race results
      const raceResults = await this.prisma.raceResult.findMany({
        where: { raceId },
        include: { driver: true },
      });

      // Create a map of driver results for quick lookup
      const driverResultsMap = new Map(
        raceResults.map(r => [r.driverId, r])
      );

      // Calculate score for each league member
      for (const member of league.members) {
        // Get driver picks for this race (2 drivers per race)
        const picks = member.draftPicks;
        
        let driver1Id: string | null = null;
        let driver2Id: string | null = null;

        // Sort by round to get consistent driver1/driver2 assignment
        const sortedPicks = picks.sort((a, b) => a.round - b.round);
        
        if (sortedPicks.length >= 1) {
          driver1Id = sortedPicks[0].driverId;
        }
        if (sortedPicks.length >= 2) {
          driver2Id = sortedPicks[1].driverId;
        }

        // Calculate driver scores
        let driver1Score = 0;
        let driver2Score = 0;

        if (driver1Id) {
          const result1 = driverResultsMap.get(driver1Id);
          if (result1) {
            driver1Score = this.calculateDriverScore(
              result1.position,
              result1.status,
              result1.fastestLap,
              scoringType
            );
          }
        }

        if (driver2Id) {
          const result2 = driverResultsMap.get(driver2Id);
          if (result2) {
            driver2Score = this.calculateDriverScore(
              result2.position,
              result2.status,
              result2.fastestLap,
              scoringType
            );
          }
        }

        const totalScore = driver1Score + driver2Score;
        
        // Check for Double Goose Egg (both drivers scored 0 AND both had actual drivers)
        const isDGE = driver1Score === 0 && driver2Score === 0 && 
                      driver1Id !== null && driver2Id !== null;

        result.scores.push({
          leagueMemberId: member.id,
          driver1Id,
          driver2Id,
          driver1Score,
          driver2Score,
          totalScore,
          isDGE,
        });
      }

      // Determine weekly winner(s) - highest score (ties allowed)
      if (result.scores.length > 0) {
        const maxScore = Math.max(...result.scores.map(s => s.totalScore));
        result.weeklyWinnerIds = result.scores
          .filter(s => s.totalScore === maxScore)
          .map(s => s.leagueMemberId);
      }
    } catch (error) {
      result.errors.push(`Failed to calculate scores: ${error}`);
    }

    return result;
  }

  /**
   * Save race scores to database
   */
  async saveRaceScores(scoreResult: RaceScoreResult): Promise<void> {
    const { raceId, leagueId, scores, weeklyWinnerIds } = scoreResult;

    // Use transaction to ensure atomicity
    await this.prisma.$transaction(async (tx) => {
      for (const score of scores) {
        // Upsert race score
        await tx.raceScore.upsert({
          where: {
            leagueId_raceId_leagueMemberId: {
              leagueId,
              raceId,
              leagueMemberId: score.leagueMemberId,
            },
          },
          update: {
            driver1Score: score.driver1Score,
            driver2Score: score.driver2Score,
            totalScore: score.totalScore,
            isWeeklyWinner: weeklyWinnerIds.includes(score.leagueMemberId),
            isDGE: score.isDGE,
            updatedAt: new Date(),
          },
          create: {
            leagueId,
            raceId,
            leagueMemberId: score.leagueMemberId,
            driver1Score: score.driver1Score,
            driver2Score: score.driver2Score,
            totalScore: score.totalScore,
            isWeeklyWinner: weeklyWinnerIds.includes(score.leagueMemberId),
            isDGE: score.isDGE,
          },
        });

        // Update league member stats
        const isWinner = weeklyWinnerIds.includes(score.leagueMemberId);
        await tx.leagueMemberStat.upsert({
          where: { leagueMemberId: score.leagueMemberId },
          update: {
            totalPoints: { increment: score.totalScore },
            weeklyWins: isWinner ? { increment: 1 } : undefined,
            dgeCount: score.isDGE ? { increment: 1 } : undefined,
            updatedAt: new Date(),
          },
          create: {
            leagueMemberId: score.leagueMemberId,
            totalPoints: score.totalScore,
            weeklyWins: isWinner ? 1 : 0,
            dgeCount: score.isDGE ? 1 : 0,
          },
        });
      }
    });
  }

  /**
   * Calculate and save scores for all leagues for a specific race
   * Called after race results are imported
   */
  async calculateAndSaveAllLeagueScores(raceId: string): Promise<{
    leaguesProcessed: number;
    errors: string[];
  }> {
    const result = {
      leaguesProcessed: 0,
      errors: [] as string[],
    };

    try {
      // Get the race with season info
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

      // Calculate scores for each league
      for (const league of leagues) {
        try {
          const scoreResult = await this.calculateRaceScores(league.id, raceId);
          
          if (scoreResult.errors.length > 0) {
            result.errors.push(...scoreResult.errors.map(e => `League ${league.id}: ${e}`));
          } else {
            await this.saveRaceScores(scoreResult);
            result.leaguesProcessed++;
          }
        } catch (error) {
          result.errors.push(`League ${league.id}: Failed to process - ${error}`);
        }
      }

      console.log(`[ScoringService] Processed ${result.leaguesProcessed} leagues for race ${raceId}`);
    } catch (error) {
      result.errors.push(`Failed to process race ${raceId}: ${error}`);
    }

    return result;
  }

  /**
   * Get league standings
   */
  async getLeagueStandings(leagueId: string): Promise<StandingsEntry[]> {
    // Get all race scores for the league
    const raceScores = await this.prisma.raceScore.findMany({
      where: { leagueId },
      include: {
        leagueMember: {
          include: {
            user: true,
            stats: true,
          },
        },
        race: {
          include: { season: true },
        },
      },
    });

    // Get unique members and their scores
    const memberMap = new Map<string, StandingsEntry>();

    for (const score of raceScores) {
      const memberId = score.leagueMemberId;
      
      if (!memberMap.has(memberId)) {
        memberMap.set(memberId, {
          rank: 0,
          leagueMemberId: memberId,
          userId: score.leagueMember.userId,
          username: score.leagueMember.user.username,
          displayName: score.leagueMember.user.displayName,
          teamName: score.leagueMember.teamName,
          totalPoints: 0,
          weeklyWins: 0,
          dgeCount: 0,
          raceScores: [],
        });
      }

      const entry = memberMap.get(memberId)!;
      entry.totalPoints += score.totalScore;
      if (score.isWeeklyWinner) {
        entry.weeklyWins++;
      }
      entry.raceScores.push({
        raceId: score.raceId,
        raceName: score.race.raceName,
        round: score.race.round,
        score: score.totalScore,
        isWeeklyWinner: score.isWeeklyWinner,
      });
    }

    // Update DGE count from stats
    for (const [memberId, entry] of memberMap) {
      const score = raceScores.find(s => s.leagueMemberId === memberId);
      if (score?.leagueMember.stats) {
        entry.dgeCount = score.leagueMember.stats.dgeCount;
      }
    }

    // Sort by total points descending
    const standings = Array.from(memberMap.values());
    standings.sort((a, b) => b.totalPoints - a.totalPoints);

    // Assign ranks
    for (let i = 0; i < standings.length; i++) {
      standings[i].rank = i + 1;
    }

    // Sort race scores by round
    for (const entry of standings) {
      entry.raceScores.sort((a, b) => a.round - b.round);
    }

    return standings;
  }

  /**
   * Get complete league standings view with draft status
   */
  async getLeagueStandingsView(leagueId: string): Promise<LeagueStandingsView> {
    // Get league info
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      include: { season: true },
    });

    if (!league) {
      throw new Error('League not found');
    }

    // Get standings
    const standings = await this.getLeagueStandings(leagueId);

    // Get current week draft status
    const currentWeek = await this.getCurrentWeekDraftStatus(leagueId);

    return {
      leagueId: league.id,
      leagueName: league.name,
      seasonId: league.seasonId,
      seasonYear: league.season.year,
      visibility: league.visibility as 'public' | 'private',
      standings,
      currentWeek,
    };
  }

  /**
   * Get member's race-by-race history with driver details
   */
  async getMemberRaceHistory(leagueMemberId: string): Promise<MemberRaceHistory[]> {
    // Get all race scores for this member
    const raceScoresRaw = await this.prisma.raceScore.findMany({
      where: { leagueMemberId },
      include: {
        race: true,
        leagueMember: {
          include: { league: true },
        },
      },
      orderBy: {
        race: { round: 'asc' },
      },
    });
    const raceScores = raceScoresRaw as unknown as Array<{ 
      raceId: string; 
      race: any; 
      leagueMember: any; 
      driver1Score: number; 
      driver2Score: number; 
      totalScore: number; 
      isWeeklyWinner: boolean; 
      isDGE: boolean 
    }>;

    // Get all draft picks for this member
    const leagueMember = await this.prisma.leagueMember.findUnique({
      where: { id: leagueMemberId },
      include: {
        league: true,
        draftPicks: {
          include: {
            driver: true,
            draftWindow: {
              include: { race: true },
            },
          },
        },
      },
    });

    if (!leagueMember) {
      return [];
    }

    // Build history for each race
    const history: MemberRaceHistory[] = [];

    for (const score of raceScores) {
      // Find picks for this race
      const racePicks = leagueMember.draftPicks.filter(
        p => p.draftWindow.raceId === score.raceId
      );

      const sortedPicks = racePicks.sort((a, b) => a.round - b.round);

      const driver1 = sortedPicks[0]?.driver;
      const driver2 = sortedPicks[1]?.driver;

      history.push({
        raceId: score.raceId,
        raceName: score.race.raceName,
        round: score.race.round,
        date: score.race.date,
        driver1: driver1 ? {
          id: driver1.id,
          code: driver1.code,
          name: `${driver1.givenName} ${driver1.familyName}`,
        } : null,
        driver2: driver2 ? {
          id: driver2.id,
          code: driver2.code,
          name: `${driver2.givenName} ${driver2.familyName}`,
        } : null,
        driver1Score: score.driver1Score,
        driver2Score: score.driver2Score,
        totalScore: score.totalScore,
        isWeeklyWinner: score.isWeeklyWinner,
        isDGE: score.isDGE,
      });
    }

    return history;
  }

  /**
   * Get current week draft status for a league
   */
  async getCurrentWeekDraftStatus(leagueId: string): Promise<CurrentWeekDraftStatus | null> {
    // Get the current or next race with an open/upcoming draft window
    const draftWindow = await this.prisma.draftWindow.findFirst({
      where: {
        leagueId,
        status: { in: ['open', 'upcoming'] },
      },
      include: {
        race: true,
        picks: true,
      },
      orderBy: {
        opensAt: 'asc',
      },
    });

    if (!draftWindow) {
      // Check if there's any race this season without a draft window
      const league = await this.prisma.league.findUnique({
        where: { id: leagueId },
        include: { season: true },
      });

      if (!league) return null;

      // Find the next race without results
      const nextRace = await this.prisma.race.findFirst({
        where: {
          seasonId: league.seasonId,
          results: { none: {} },
          date: { gte: new Date() },
        },
        orderBy: { date: 'asc' },
      });

      if (!nextRace) return null;

      return {
        draftWindowId: null,
        raceId: nextRace.id,
        raceName: nextRace.raceName,
        round: nextRace.round,
        draftStatus: 'no_draft',
        opensAt: null,
        closesAt: null,
        currentRound: null,
        currentTurnMemberId: null,
        turnExpiresAt: null,
        pickedMembers: [],
      };
    }

    // Get league members with their pick status
    const members = await this.prisma.leagueMember.findMany({
      where: {
        leagueId,
        leftAt: null,
      },
    });

    const pickedMembers = members.map(member => {
      const memberPicks = draftWindow.picks.filter(p => p.leagueMemberId === member.id);
      const hasPickedRound1 = memberPicks.some(p => p.round === 1);
      const hasPickedRound2 = memberPicks.some(p => p.round === 2);

      return {
        leagueMemberId: member.id,
        teamName: member.teamName,
        hasPickedRound1,
        hasPickedRound2,
      };
    });

    // Calculate current turn if draft is open
    let currentRound: number | null = null;
    let currentTurnMemberId: string | null = null;
    let turnExpiresAt: Date | null = null;

    if (draftWindow.status === 'open') {
      const round1Picks = draftWindow.picks.filter(p => p.round === 1);
      const round2Picks = draftWindow.picks.filter(p => p.round === 2);

      if (round1Picks.length < members.length) {
        currentRound = 1;
        // Current turn is next in order
        const pickedMemberIds = round1Picks.map(p => p.leagueMemberId);
        currentTurnMemberId = members.find(m => !pickedMemberIds.includes(m.id))?.id || null;
      } else if (round2Picks.length < members.length) {
        currentRound = 2;
        const pickedMemberIds = round2Picks.map(p => p.leagueMemberId);
        currentTurnMemberId = members.find(m => !pickedMemberIds.includes(m.id))?.id || null;
      }

      // Calculate turn expiry (24 hours from last pick or window open)
      if (currentTurnMemberId) {
        const lastPick = [...draftWindow.picks].sort((a, b) => 
          (b.submittedAt?.getTime() || 0) - (a.submittedAt?.getTime() || 0)
        )[0];

        const lastPickTime = lastPick?.submittedAt || draftWindow.opensAt;
        turnExpiresAt = new Date(lastPickTime.getTime() + 24 * 60 * 60 * 1000);
        
        // Don't exceed draft window close time
        if (turnExpiresAt > draftWindow.closesAt) {
          turnExpiresAt = draftWindow.closesAt;
        }
      }
    }

    return {
      draftWindowId: draftWindow.id,
      raceId: draftWindow.raceId,
      raceName: draftWindow.race.raceName,
      round: draftWindow.race.round,
      draftStatus: draftWindow.status as 'upcoming' | 'open' | 'closed' | 'completed',
      opensAt: draftWindow.opensAt,
      closesAt: draftWindow.closesAt,
      currentRound,
      currentTurnMemberId,
      turnExpiresAt,
      pickedMembers,
    };
  }

  /**
   * Get race scores for a specific race in a league
   */
  async getRaceScoresForLeague(leagueId: string, raceId: string) {
    return this.prisma.raceScore.findMany({
      where: {
        leagueId,
        raceId,
      },
      include: {
        leagueMember: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
              },
            },
          },
        },
        race: true,
      },
      orderBy: {
        totalScore: 'desc',
      },
    });
  }

  /**
   * Recalculate all scores for a league (used when scoring type changes or admin override)
   */
  async recalculateAllLeagueScores(leagueId: string): Promise<void> {
    // Get league
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
    });

    if (!league) return;

    // Get all race scores for this league
    const existingScores = await this.prisma.raceScore.findMany({
      where: { leagueId },
    });

    // Reset all member stats
    const memberIds = [...new Set(existingScores.map(s => s.leagueMemberId))];
    
    await this.prisma.$transaction(async (tx) => {
      // Reset stats
      for (const memberId of memberIds) {
        await tx.leagueMemberStat.update({
          where: { leagueMemberId: memberId },
          data: {
            totalPoints: 0,
            weeklyWins: 0,
            dgeCount: 0,
          },
        });
      }

      // Delete all race scores
      await tx.raceScore.deleteMany({
        where: { leagueId },
      });
    });

    // Get all races that have results
    const racesWithResults = await this.prisma.race.findMany({
      where: {
        seasonId: league.seasonId,
        results: { some: {} },
      },
    });

    // Recalculate scores for each race
    for (const race of racesWithResults) {
      const scoreResult = await this.calculateRaceScores(leagueId, race.id);
      if (scoreResult.errors.length === 0) {
        await this.saveRaceScores(scoreResult);
      }
    }

    console.log(`[ScoringService] Recalculated scores for league ${leagueId}`);
  }

  /**
   * Get season podium for a league (top 3 by cumulative points)
   */
  async getSeasonPodium(leagueId: string): Promise<SeasonPodium> {
    // Get league with season info
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      include: { season: true },
    });

    if (!league) {
      throw new Error('League not found');
    }

    // Check if season is completed (all races have results)
    const seasonRaces = await this.prisma.race.findMany({
      where: { seasonId: league.seasonId },
      include: { results: true },
    });

    const isCompleted = seasonRaces.length > 0 && 
      seasonRaces.every(race => race.results.length > 0);

    // Get standings
    const standings = await this.getLeagueStandings(leagueId);

    // Get top 3 (or fewer if not enough members)
    const podium = standings.slice(0, 3).map((entry, index) => ({
      position: index + 1,
      leagueMemberId: entry.leagueMemberId,
      userId: entry.userId,
      teamName: entry.teamName,
      totalPoints: entry.totalPoints,
      weeklyWins: entry.weeklyWins,
      dgeCount: entry.dgeCount,
    }));

    return {
      seasonId: league.seasonId,
      seasonYear: league.season.year,
      isCompleted,
      podium,
    };
  }

  /**
   * Get all weekly winners for a league
   */
  async getWeeklyWinners(leagueId: string): Promise<WeeklyWinner[]> {
    // Get all race scores with weekly winners
    const weeklyWinnerScores = await this.prisma.raceScore.findMany({
      where: {
        leagueId,
        isWeeklyWinner: true,
      },
      include: {
        race: true,
        leagueMember: true,
      },
      orderBy: {
        race: { round: 'asc' },
      },
    });

    // Group by race
    const raceMap = new Map<string, WeeklyWinner>();

    for (const score of weeklyWinnerScores) {
      const raceId = score.raceId;
      
      if (!raceMap.has(raceId)) {
        raceMap.set(raceId, {
          raceId,
          raceName: score.race.raceName,
          round: score.race.round,
          winners: [],
        });
      }

      raceMap.get(raceId)!.winners.push({
        leagueMemberId: score.leagueMemberId,
        teamName: score.leagueMember.teamName,
        score: score.totalScore,
      });
    }

    return Array.from(raceMap.values()).sort((a, b) => a.round - b.round);
  }

  /**
   * Get driver standings within a league context (based on league's scoring type)
   * This shows how each driver scores according to the league's scoring method
   */
  async getLeagueDriverStandings(leagueId: string): Promise<LeagueDriverStanding[]> {
    // Get league with scoring type
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      include: { season: true },
    });

    if (!league) {
      throw new Error('League not found');
    }

    const scoringType = league.scoringType as ScoringType;

    // Get all races with results for this season
    const races = await this.prisma.race.findMany({
      where: {
        seasonId: league.seasonId,
        results: { some: {} },
      },
      include: {
        results: {
          include: {
            driver: true,
          },
        },
      },
      orderBy: { round: 'asc' },
    });

    // Calculate driver scores across all races
    const driverScores = new Map<string, LeagueDriverStanding>();

    for (const race of races) {
      for (const result of race.results) {
        const driverId = result.driverId;

        if (!driverScores.has(driverId)) {
          driverScores.set(driverId, {
            driverId: driverId,
            driverCode: result.driver.code,
            driverName: `${result.driver.givenName} ${result.driver.familyName}`,
            driverNumber: result.driver.permanentNumber?.toString() || 'N/A',
            nationality: result.driver.nationality,
            totalPoints: 0,
            racesStarted: 0,
            wins: 0,
            podiums: 0,
            fastestLaps: 0,
            dnfs: 0,
            raceResults: [],
          });
        }

        const standing = driverScores.get(driverId)!;
        
        // Calculate score using league's scoring type
        const score = this.calculateDriverScore(
          result.position,
          result.status,
          result.fastestLap,
          scoringType
        );

        standing.totalPoints += score;
        standing.racesStarted++;
        
        if (result.position === 1) standing.wins++;
        if (result.position <= 3) standing.podiums++;
        if (result.fastestLap) standing.fastestLaps++;
        
        const normalizedStatus = this.normalizeStatus(result.status);
        if (normalizedStatus === 'DNF') standing.dnfs++;

        standing.raceResults.push({
          raceId: race.id,
          raceName: race.raceName,
          round: race.round,
          position: result.position,
          status: result.status,
          points: score,
          fastestLap: result.fastestLap,
        });
      }
    }

    // Sort by total points descending
    const standings = Array.from(driverScores.values());
    standings.sort((a, b) => b.totalPoints - a.totalPoints);

    // Assign positions
    for (let i = 0; i < standings.length; i++) {
      standings[i].position = i + 1;
    }

    // Sort race results by round for each driver
    for (const standing of standings) {
      standing.raceResults.sort((a, b) => a.round - b.round);
    }

    return standings;
  }

  /**
   * Get weekly winner for a specific race
   */
  async getWeeklyWinnerForRace(leagueId: string, raceId: string): Promise<WeeklyWinner | null> {
    const winnerScores = await this.prisma.raceScore.findMany({
      where: {
        leagueId,
        raceId,
        isWeeklyWinner: true,
      },
      include: {
        race: true,
        leagueMember: true,
      },
    });

    if (winnerScores.length === 0) {
      return null;
    }

    return {
      raceId,
      raceName: winnerScores[0].race.raceName,
      round: winnerScores[0].race.round,
      winners: winnerScores.map(score => ({
        leagueMemberId: score.leagueMemberId,
        teamName: score.leagueMember.teamName,
        score: score.totalScore,
      })),
    };
  }
}

export default ScoringService;
