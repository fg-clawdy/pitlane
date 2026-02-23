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
          leagueMemberId: memberId,
          userId: score.leagueMember.userId,
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

    // Sort race scores by round
    for (const entry of standings) {
      entry.raceScores.sort((a, b) => a.round - b.round);
    }

    return standings;
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
}

export default ScoringService;