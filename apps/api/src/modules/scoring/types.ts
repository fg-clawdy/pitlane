/**
 * Scoring Module Types
 * Type definitions for scoring engine
 */

export type ScoringType = 'fia_official' | 'linear_20' | 'proprietary';

export type FinishStatus = 'Finished' | 'DNF' | 'DNS' | 'DSQ' | 'Other';

export interface DriverScore {
  driverId: string;
  position: number | null;
  status: FinishStatus;
  fastestLap: boolean;
  fastestLapInTop10: boolean;
  points: number;
}

export interface PlayerRaceScore {
  leagueMemberId: string;
  driver1Id: string | null;
  driver2Id: string | null;
  driver1Score: number;
  driver2Score: number;
  totalScore: number;
  isDGE: boolean; // Double Goose Egg - both drivers score 0
}

export interface RaceScoreResult {
  raceId: string;
  leagueId: string;
  scores: PlayerRaceScore[];
  weeklyWinnerIds: string[];
  errors: string[];
}

export interface ScoringTable {
  [position: number]: number;
}

export interface ScoringConfig {
  type: ScoringType;
  table: ScoringTable;
  fastestLapBonus: number;
  fastestLapRequiresTop10: boolean;
  dnfScore: number;
  dnsScore: number;
  dsqScore: number;
  noDriverScore: number;
}

// FIA Official Scoring (as of 2024 season)
export const FIA_SCORING_TABLE: ScoringTable = {
  1: 25,
  2: 18,
  3: 15,
  4: 12,
  5: 10,
  6: 8,
  7: 6,
  8: 4,
  9: 2,
  10: 1,
  // Positions 11-20 score 0
};

// Linear 20-point system
export const LINEAR_20_SCORING_TABLE: ScoringTable = {
  1: 20,
  2: 19,
  3: 18,
  4: 17,
  5: 16,
  6: 15,
  7: 14,
  8: 13,
  9: 12,
  10: 11,
  11: 10,
  12: 9,
  13: 8,
  14: 7,
  15: 6,
  16: 5,
  17: 4,
  18: 3,
  19: 2,
  20: 1,
};

// Proprietary system (10th = 10 points max)
// Formula: max(0, 10 - abs(position - 10))
export const PROPRIETARY_SCORING_TABLE: ScoringTable = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  11: 9,
  12: 8,
  13: 7,
  14: 6,
  15: 5,
  16: 4,
  17: 3,
  18: 2,
  19: 1,
  20: 1,
};

export const SCORING_CONFIGS: Record<ScoringType, ScoringConfig> = {
  fia_official: {
    type: 'fia_official',
    table: FIA_SCORING_TABLE,
    fastestLapBonus: 1,
    fastestLapRequiresTop10: true,
    dnfScore: 0,
    dnsScore: 0,
    dsqScore: 0,
    noDriverScore: 0,
  },
  linear_20: {
    type: 'linear_20',
    table: LINEAR_20_SCORING_TABLE,
    fastestLapBonus: 0, // No fastest lap bonus in linear system
    fastestLapRequiresTop10: false,
    dnfScore: 0,
    dnsScore: 0,
    dsqScore: 0,
    noDriverScore: 0,
  },
  proprietary: {
    type: 'proprietary',
    table: PROPRIETARY_SCORING_TABLE,
    fastestLapBonus: 0, // No fastest lap bonus in proprietary system
    fastestLapRequiresTop10: false,
    dnfScore: 0,
    dnsScore: 0,
    dsqScore: 0,
    noDriverScore: 0,
  },
};

export interface StandingsEntry {
  leagueMemberId: string;
  userId: string;
  teamName: string;
  totalPoints: number;
  weeklyWins: number;
  dgeCount: number;
  raceScores: Array<{
    raceId: string;
    raceName: string;
    round: number;
    score: number;
    isWeeklyWinner: boolean;
  }>;
}

export interface SeasonPodium {
  seasonId: string;
  seasonYear: number;
  isCompleted: boolean;
  podium: Array<{
    position: number;
    leagueMemberId: string;
    userId: string;
    teamName: string;
    totalPoints: number;
    weeklyWins: number;
    dgeCount: number;
  }>;
}

export interface WeeklyWinner {
  raceId: string;
  raceName: string;
  round: number;
  winners: Array<{
    leagueMemberId: string;
    teamName: string;
    score: number;
  }>;
}
