/**
 * Drafts Module Types
 * Type definitions for draft system
 */

export type DraftType = 'snake' | 'regular';
export type DraftStatus = 'upcoming' | 'open' | 'closed' | 'completed';
export type ResolutionMethod = 'manual' | 'auto_preference' | 'random' | 'top_points' | 'no_pick';

export interface DraftWindow {
  id: string;
  leagueId: string;
  raceId: string;
  opensAt: Date;
  closesAt: Date;
  status: DraftStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface DraftPick {
  id: string;
  draftWindowId: string;
  leagueMemberId: string;
  driverId: string;
  round: number;
  pickOrder: number;
  resolutionMethod: ResolutionMethod | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDraftWindowInput {
  leagueId: string;
  raceId: string;
}

export interface DraftState {
  draftWindowId: string;
  status: DraftStatus;
  currentRound: number;
  currentPickPosition: number;
  currentTurnMemberId: string | null;
  turnExpiresAt: Date | null;
  picks: DraftPick[];
  availableDrivers: string[];
  draftOrder: DraftOrderEntry[];
}

export interface DraftOrderEntry {
  leagueMemberId: string;
  userId: string;
  teamName: string;
  position: number;
  round1PickOrder: number;
  round2PickOrder: number;
}

export interface PickValidation {
  isValid: boolean;
  error?: string;
}

export interface SubmitPickInput {
  draftWindowId: string;
  leagueMemberId: string;
  driverId: string;
}

export interface DraftWindowOutput {
  id: string;
  leagueId: string;
  raceId: string;
  raceName: string;
  round: number;
  opensAt: Date;
  closesAt: Date;
  status: DraftStatus;
  currentRound: number | null;
  currentPickPosition: number | null;
  currentTurnMemberId: string | null;
  turnExpiresAt: Date | null;
  draftOrder: DraftOrderEntry[];
  picks: Array<{
    id: string;
    leagueMemberId: string;
    teamName: string;
    driverId: string;
    driverCode: string;
    driverName: string;
    round: number;
    pickOrder: number;
    resolutionMethod: ResolutionMethod | null;
    submittedAt: Date | null;
  }>;
  availableDrivers: Array<{
    id: string;
    code: string;
    name: string;
    team: string;
    seasonPoints: number;
    lastRacePosition: number | null;
  }>;
}

// WebSocket event types for draft
export interface DraftWebSocketMessage {
  type: 'pick_submitted' | 'draft_completed' | 'turn_changed' | 'draft_state_update';
  payload: any;
  timestamp: Date;
}

export interface PickSubmittedPayload {
  pick: {
    id: string;
    leagueMemberId: string;
    teamName: string;
    driverId: string;
    driverCode: string;
    driverName: string;
    round: number;
    pickOrder: number;
    resolutionMethod: ResolutionMethod | null;
    submittedAt: Date | null;
  };
  nextTurn: {
    leagueMemberId: string | null;
    teamName: string | null;
    round: number;
    expiresAt: Date | null;
  } | null;
  draftCompleted: boolean;
}

// System settings defaults
export const DEFAULT_DRAFT_PICK_TIMEOUT_HOURS = 24;

// Draft window opens Monday 00:00 GMT of race week
export function calculateDraftOpenTime(raceDate: Date): Date {
  const race = new Date(raceDate);
  // Get the Monday of race week (race is typically Sunday)
  const dayOfWeek = race.getUTCDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(race);
  monday.setUTCDate(race.getUTCDate() + daysToMonday);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

// Draft closes at qualifying start time (typically Saturday 15:00 or 16:00 local)
// For simplicity, we assume qualifying is 1 day before race at 14:00 UTC
export function calculateDraftCloseTime(raceDate: Date, raceTime: string | null): Date {
  const race = new Date(raceDate);
  // Qualifying is typically the day before the race
  const qualDate = new Date(race);
  qualDate.setUTCDate(race.getUTCDate() - 1);
  qualDate.setUTCHours(14, 0, 0, 0); // Default to 14:00 UTC
  
  return qualDate;
}