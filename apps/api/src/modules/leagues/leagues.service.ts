import { PrismaClient } from '@prisma/client';
import { 
  CreateLeagueInput, 
  LeagueResponse, 
  LeagueFilter,
  ScoringType,
  DraftType,
  Visibility,
  MissedPickResolution,
  SubstitutionPolicy
} from './types';

export class LeaguesService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new league. The creator becomes the commissioner (first member).
   */
  async createLeague(userId: string, input: CreateLeagueInput): Promise<LeagueResponse> {
    // Validate league name length
    if (input.name.length < 3 || input.name.length > 80) {
      throw new Error('League name must be between 3 and 80 characters');
    }

    // Check if league name is unique for this season
    const existingLeague = await this.prisma.league.findUnique({
      where: {
        seasonId_name: {
          seasonId: input.seasonId,
          name: input.name,
        },
      },
    });

    if (existingLeague) {
      throw new Error('League name already exists for this season');
    }

    // Validate max players (2-11 players per PRD)
    const maxPlayers = input.maxPlayers ?? 11;
    if (maxPlayers < 2 || maxPlayers > 11) {
      throw new Error('Max players must be between 2 and 11');
    }

    // Check user's current league count (max 10 leagues per user)
    const userLeagueCount = await this.prisma.leagueMember.count({
      where: {
        userId,
        leftAt: null,
      },
    });

    if (userLeagueCount >= 10) {
      throw new Error('You have reached the maximum of 10 leagues');
    }

    // Validate season exists
    const season = await this.prisma.season.findUnique({
      where: { id: input.seasonId },
    });

    if (!season) {
      throw new Error('Season not found');
    }

    // Create league with user as first member (commissioner)
    const league = await this.prisma.league.create({
      data: {
        name: input.name,
        seasonId: input.seasonId,
        scoringType: input.scoringType ?? 'proprietary',
        draftType: input.draftType ?? 'snake',
        visibility: input.visibility ?? 'private',
        joinApprovalRequired: input.joinApprovalRequired ?? false,
        targetPlayers: input.targetPlayers ?? maxPlayers,
        maxPlayers: maxPlayers,
        missedPickResolution: input.missedPickResolution ?? 'random',
        substitutionPolicy: input.substitutionPolicy ?? 'auto_replace',
        draftOrderRandomized: input.draftOrderRandomized ?? false,
        members: {
          create: {
            userId,
            teamName: '', // Will be set from user's default team name
          },
        },
      },
      include: {
        members: true,
      },
    });

    // Get user's default team name for the league membership
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { defaultTeamName: true },
    });

    // Update member with default team name
    if (league.members[0]) {
      await this.prisma.leagueMember.update({
        where: { id: league.members[0].id },
        data: { 
          teamName: user?.defaultTeamName || `Team ${userId.slice(0, 4)}` 
        },
      });
    }

    return {
      id: league.id,
      name: league.name,
      seasonId: league.seasonId,
      scoringType: league.scoringType,
      draftType: league.draftType,
      visibility: league.visibility,
      joinApprovalRequired: league.joinApprovalRequired,
      targetPlayers: league.targetPlayers,
      maxPlayers: league.maxPlayers,
      missedPickResolution: league.missedPickResolution,
      substitutionPolicy: league.substitutionPolicy,
      draftOrderRandomized: league.draftOrderRandomized,
      createdAt: league.createdAt,
      updatedAt: league.updatedAt,
      memberCount: 1,
      isCommissioner: true,
    };
  }

  /**
   * Get a league by ID
   */
  async getLeagueById(leagueId: string, userId?: string): Promise<LeagueResponse | null> {
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        members: {
          where: { leftAt: null },
        },
      },
    });

    if (!league) {
      return null;
    }

    // Check if user is commissioner (first member)
    const commissioner = league.members[0];
    const isCommissioner = !!(userId && commissioner?.userId === userId);

    return {
      id: league.id,
      name: league.name,
      seasonId: league.seasonId,
      scoringType: league.scoringType,
      draftType: league.draftType,
      visibility: league.visibility,
      joinApprovalRequired: league.joinApprovalRequired,
      targetPlayers: league.targetPlayers,
      maxPlayers: league.maxPlayers,
      missedPickResolution: league.missedPickResolution,
      substitutionPolicy: league.substitutionPolicy,
      draftOrderRandomized: league.draftOrderRandomized,
      createdAt: league.createdAt,
      updatedAt: league.updatedAt,
      memberCount: league.members.length,
      isCommissioner: isCommissioner ?? false,
    };
  }

  /**
   * Get public leagues (for discovery)
   */
  async getPublicLeagues(filters?: LeagueFilter): Promise<LeagueResponse[]> {
    const where: any = {
      visibility: 'public',
    };

    if (filters?.seasonId) {
      where.seasonId = filters.seasonId;
    }

    const leagues = await this.prisma.league.findMany({
      where,
      include: {
        members: {
          where: { leftAt: null },
        },
      },
    });

    let result = leagues.map((league) => ({
      id: league.id,
      name: league.name,
      seasonId: league.seasonId,
      scoringType: league.scoringType,
      draftType: league.draftType,
      visibility: league.visibility,
      joinApprovalRequired: league.joinApprovalRequired,
      targetPlayers: league.targetPlayers,
      maxPlayers: league.maxPlayers,
      missedPickResolution: league.missedPickResolution,
      substitutionPolicy: league.substitutionPolicy,
      draftOrderRandomized: league.draftOrderRandomized,
      createdAt: league.createdAt,
      updatedAt: league.updatedAt,
      memberCount: league.members.length,
    }));

    // Filter by hasSpace if requested
    if (filters?.hasSpace) {
      result = result.filter((league) => league.memberCount < league.maxPlayers);
    }

    return result;
  }

  /**
   * Get leagues for a user
   */
  async getUserLeagues(userId: string): Promise<LeagueResponse[]> {
    const memberships = await this.prisma.leagueMember.findMany({
      where: {
        userId,
        leftAt: null,
      },
      include: {
        league: {
          include: {
            members: {
              where: { leftAt: null },
            },
          },
        },
      },
    });

    return memberships.map((membership) => {
      const league = membership.league;
      const commissioner = league.members[0];
      const isCommissioner = commissioner?.userId === userId;

      return {
        id: league.id,
        name: league.name,
        seasonId: league.seasonId,
        scoringType: league.scoringType,
        draftType: league.draftType,
        visibility: league.visibility,
        joinApprovalRequired: league.joinApprovalRequired,
        targetPlayers: league.targetPlayers,
        maxPlayers: league.maxPlayers,
        missedPickResolution: league.missedPickResolution,
        substitutionPolicy: league.substitutionPolicy,
        draftOrderRandomized: league.draftOrderRandomized,
        createdAt: league.createdAt,
        updatedAt: league.updatedAt,
        memberCount: league.members.length,
        isCommissioner,
      };
    });
  }
}