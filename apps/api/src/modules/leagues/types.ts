// League types and interfaces

export type ScoringType = 'fia_official' | 'linear_20' | 'proprietary';
export type DraftType = 'snake' | 'regular';
export type Visibility = 'public' | 'private';
export type MissedPickResolution = 'random' | 'top_points' | 'no_pick';
export type SubstitutionPolicy = 'redraft' | 'auto_replace';

export interface CreateLeagueInput {
  name: string;
  seasonId: string;
  scoringType?: ScoringType;
  draftType?: DraftType;
  visibility?: Visibility;
  joinApprovalRequired?: boolean;
  targetPlayers?: number;
  maxPlayers?: number;
  missedPickResolution?: MissedPickResolution;
  substitutionPolicy?: SubstitutionPolicy;
  draftOrderRandomized?: boolean;
}

export interface LeagueResponse {
  id: string;
  name: string;
  seasonId: string;
  scoringType: string;
  draftType: string;
  visibility: string;
  joinApprovalRequired: boolean;
  targetPlayers: number;
  maxPlayers: number;
  missedPickResolution: string;
  substitutionPolicy: string;
  draftOrderRandomized: boolean;
  createdAt: Date;
  updatedAt: Date;
  memberCount?: number;
  isCommissioner?: boolean;
}

export interface LeagueMemberResponse {
  id: string;
  leagueId: string;
  userId: string;
  teamName: string;
  joinedAt: Date;
  leftAt: Date | null;
  user?: {
    id: string;
    username: string;
    displayName: string | null;
  };
}

export interface LeagueFilter {
  visibility?: Visibility;
  seasonId?: string;
  hasSpace?: boolean;
}

export interface JoinLeagueInput {
  teamName: string;
}

export interface JoinRequestResponse {
  id: string;
  leagueId: string;
  userId: string;
  teamName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export interface InviteLinkResponse {
  id: string;
  leagueId: string;
  token: string;
  expiresAt: Date;
  maxUses: number | null;
  usesCount: number;
  createdAt: Date;
}

export interface JoinViaInviteResponse {
  league: LeagueResponse;
  requiresApproval: boolean;
  joinRequest?: JoinRequestResponse;
  joined?: boolean;
}

export interface UpdateLeagueInput {
  name?: string;
  visibility?: Visibility;
  joinApprovalRequired?: boolean;
  targetPlayers?: number;
  maxPlayers?: number;
  missedPickResolution?: MissedPickResolution;
  substitutionPolicy?: SubstitutionPolicy;
}

export interface UpdateDraftOrderInput {
  memberIds: string[]; // Ordered list of member IDs for draft
}

export interface FlagIssueInput {
  reason: string;
  description?: string;
}

export interface CommissionerFlagResponse {
  id: string;
  leagueId: string;
  userId: string;
  reason: string;
  description: string | null;
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  createdAt: Date;
}
