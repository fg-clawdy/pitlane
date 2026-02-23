import { PrismaClient } from '@prisma/client';
import { 
  CreateLeagueInput, 
  LeagueResponse, 
  LeagueFilter,
  LeagueMemberResponse,
  JoinLeagueInput,
  JoinRequestResponse,
  InviteLinkResponse,
  JoinViaInviteResponse,
  ScoringType,
  DraftType,
  Visibility,
  MissedPickResolution,
  SubstitutionPolicy
} from './types';
import { randomBytes } from 'crypto';

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

  /**
   * Generate a unique invite token (8 characters)
   */
  private generateInviteToken(): string {
    return randomBytes(4).toString('hex');
  }

  /**
   * Join a league directly (public leagues or via invite link)
   */
  async joinLeague(leagueId: string, userId: string, input: JoinLeagueInput): Promise<JoinViaInviteResponse> {
    // Get the league with members
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        members: {
          where: { leftAt: null },
        },
      },
    });

    if (!league) {
      throw new Error('League not found');
    }

    // Check if user is already a member
    const existingMembership = await this.prisma.leagueMember.findUnique({
      where: {
        leagueId_userId: {
          leagueId,
          userId,
        },
      },
    });

    if (existingMembership && !existingMembership.leftAt) {
      throw new Error('You are already a member of this league');
    }

    // Check if league is full
    if (league.members.length >= league.maxPlayers) {
      throw new Error('League is full');
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

    // Validate team name
    if (input.teamName.length < 1 || input.teamName.length > 50) {
      throw new Error('Team name must be between 1 and 50 characters');
    }

    // Check team name uniqueness within league
    const existingTeamName = await this.prisma.leagueMember.findFirst({
      where: {
        leagueId,
        teamName: input.teamName,
        leftAt: null,
      },
    });

    if (existingTeamName) {
      throw new Error('Team name already taken in this league');
    }

    // Check if season allows joining (no more than 3 races completed)
    const completedRaces = await this.prisma.race.count({
      where: {
        seasonId: league.seasonId,
        date: { lt: new Date() },
      },
    });

    // Get max_join_cutoff_races from system settings (default 3)
    const cutoffSetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'max_join_cutoff_races' },
    });
    const maxCutoff = cutoffSetting ? (cutoffSetting.value as { value: number }).value : 3;

    if (completedRaces >= maxCutoff) {
      throw new Error('Cannot join league mid-season after 3rd race completed');
    }

    // If join approval required, create a join request instead
    if (league.joinApprovalRequired) {
      const existingRequest = await this.prisma.joinRequest.findUnique({
        where: {
          leagueId_userId: {
            leagueId,
            userId,
          },
        },
      });

      if (existingRequest && existingRequest.status === 'pending') {
        throw new Error('You already have a pending join request for this league');
      }

      // Create or update join request
      const joinRequest = await this.prisma.joinRequest.upsert({
        where: {
          leagueId_userId: {
            leagueId,
            userId,
          },
        },
        update: {
          teamName: input.teamName,
          status: 'pending',
        },
        create: {
          leagueId,
          userId,
          teamName: input.teamName,
          status: 'pending',
        },
      });

      const leagueResponse = await this.getLeagueById(leagueId, userId);
      return {
        league: leagueResponse!,
        requiresApproval: true,
        joinRequest: {
          id: joinRequest.id,
          leagueId: joinRequest.leagueId,
          userId: joinRequest.userId,
          teamName: joinRequest.teamName,
          status: joinRequest.status as 'pending' | 'approved' | 'rejected',
          createdAt: joinRequest.createdAt,
          updatedAt: joinRequest.updatedAt,
        },
      };
    }

    // Direct join (no approval required)
    await this.prisma.leagueMember.create({
      data: {
        leagueId,
        userId,
        teamName: input.teamName,
      },
    });

    const leagueResponse = await this.getLeagueById(leagueId, userId);
    return {
      league: leagueResponse!,
      requiresApproval: false,
      joined: true,
    };
  }

  /**
   * Join league via invite link token
   */
  async joinViaInviteToken(token: string, userId: string, input: JoinLeagueInput): Promise<JoinViaInviteResponse> {
    // Find the invite link
    const inviteLink = await this.prisma.inviteLink.findUnique({
      where: { token },
      include: {
        league: {
          include: {
            members: {
              where: { leftAt: null },
            },
          },
        },
        uses: true,
      },
    });

    if (!inviteLink) {
      throw new Error('Invalid invite link');
    }

    // Check if invite link is expired
    if (new Date() > inviteLink.expiresAt) {
      throw new Error('Invite link has expired');
    }

    // Check if invite link has reached max uses
    if (inviteLink.maxUses !== null && inviteLink.uses.length >= inviteLink.maxUses) {
      throw new Error('Invite link has reached maximum uses');
    }

    // Check if user already used this invite link
    const alreadyUsed = inviteLink.uses.some((use) => use.userId === userId);
    if (alreadyUsed) {
      throw new Error('You have already used this invite link');
    }

    // Join the league
    const result = await this.joinLeague(inviteLink.leagueId, userId, input);

    // If joined successfully (not pending approval), record the invite link use
    if (result.joined) {
      await this.prisma.inviteLinkUse.create({
        data: {
          inviteLinkId: inviteLink.id,
          userId,
        },
      });
    }

    return result;
  }

  /**
   * Leave a league
   */
  async leaveLeague(leagueId: string, userId: string): Promise<void> {
    // Check if user is a member
    const membership = await this.prisma.leagueMember.findUnique({
      where: {
        leagueId_userId: {
          leagueId,
          userId,
        },
      },
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

    if (!membership || membership.leftAt) {
      throw new Error('You are not a member of this league');
    }

    // Check if user is the commissioner (first member)
    const commissioner = membership.league.members[0];
    if (commissioner && commissioner.userId === userId) {
      throw new Error('Commissioner cannot leave the league. Transfer commissioner role or delete the league instead.');
    }

    // Mark as left
    await this.prisma.leagueMember.update({
      where: { id: membership.id },
      data: { leftAt: new Date() },
    });
  }

  /**
   * Create an invite link for a league
   */
  async createInviteLink(leagueId: string, userId: string, maxUses?: number): Promise<InviteLinkResponse> {
    // Verify league exists and user is commissioner
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        members: {
          where: { leftAt: null },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!league) {
      throw new Error('League not found');
    }

    const commissioner = league.members[0];
    if (!commissioner || commissioner.userId !== userId) {
      throw new Error('Only the commissioner can create invite links');
    }

    // Get invite link expiry days from system settings (default 7)
    const expirySetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'invite_link_expiry_days' },
    });
    const expiryDays = expirySetting ? (expirySetting.value as { value: number }).value : 7;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    const inviteLink = await this.prisma.inviteLink.create({
      data: {
        leagueId,
        token: this.generateInviteToken(),
        expiresAt,
        maxUses: maxUses ?? null,
      },
      include: {
        uses: true,
      },
    });

    return {
      id: inviteLink.id,
      leagueId: inviteLink.leagueId,
      token: inviteLink.token,
      expiresAt: inviteLink.expiresAt,
      maxUses: inviteLink.maxUses,
      usesCount: inviteLink.uses.length,
      createdAt: inviteLink.createdAt,
    };
  }

  /**
   * Get invite links for a league (commissioner only)
   */
  async getInviteLinks(leagueId: string, userId: string): Promise<InviteLinkResponse[]> {
    // Verify user is commissioner
    const membership = await this.prisma.leagueMember.findFirst({
      where: {
        leagueId,
        userId,
        leftAt: null,
      },
      orderBy: { joinedAt: 'asc' },
    });

    if (!membership) {
      throw new Error('Not a member of this league');
    }

    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        members: {
          where: { leftAt: null },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    const commissioner = league?.members[0];
    if (!commissioner || commissioner.userId !== userId) {
      throw new Error('Only the commissioner can view invite links');
    }

    const inviteLinks = await this.prisma.inviteLink.findMany({
      where: { leagueId },
      include: {
        uses: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return inviteLinks.map((link) => ({
      id: link.id,
      leagueId: link.leagueId,
      token: link.token,
      expiresAt: link.expiresAt,
      maxUses: link.maxUses,
      usesCount: link.uses.length,
      createdAt: link.createdAt,
    }));
  }

  /**
   * Get join requests for a league (commissioner only)
   */
  async getJoinRequests(leagueId: string, userId: string): Promise<JoinRequestResponse[]> {
    // Verify user is commissioner
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        members: {
          where: { leftAt: null },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!league) {
      throw new Error('League not found');
    }

    const commissioner = league.members[0];
    if (!commissioner || commissioner.userId !== userId) {
      throw new Error('Only the commissioner can view join requests');
    }

    const requests = await this.prisma.joinRequest.findMany({
      where: { leagueId },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((req) => ({
      id: req.id,
      leagueId: req.leagueId,
      userId: req.userId,
      teamName: req.teamName,
      status: req.status as 'pending' | 'approved' | 'rejected',
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
    }));
  }

  /**
   * Approve or reject a join request (commissioner only)
   */
  async resolveJoinRequest(
    leagueId: string,
    requestId: string,
    userId: string,
    approve: boolean
  ): Promise<JoinRequestResponse | LeagueMemberResponse> {
    // Verify user is commissioner
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        members: {
          where: { leftAt: null },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!league) {
      throw new Error('League not found');
    }

    const commissioner = league.members[0];
    if (!commissioner || commissioner.userId !== userId) {
      throw new Error('Only the commissioner can approve join requests');
    }

    // Get the join request
    const joinRequest = await this.prisma.joinRequest.findUnique({
      where: { id: requestId },
    });

    if (!joinRequest || joinRequest.leagueId !== leagueId) {
      throw new Error('Join request not found');
    }

    if (joinRequest.status !== 'pending') {
      throw new Error('Join request already resolved');
    }

    if (approve) {
      // Check if league is full
      if (league.members.length >= league.maxPlayers) {
        throw new Error('League is full');
      }

      // Check user's current league count
      const userLeagueCount = await this.prisma.leagueMember.count({
        where: {
          userId: joinRequest.userId,
          leftAt: null,
        },
      });

      if (userLeagueCount >= 10) {
        throw new Error('User has reached the maximum of 10 leagues');
      }

      // Create membership and update request
      const [member] = await this.prisma.$transaction([
        this.prisma.leagueMember.create({
          data: {
            leagueId,
            userId: joinRequest.userId,
            teamName: joinRequest.teamName,
          },
        }),
        this.prisma.joinRequest.update({
          where: { id: requestId },
          data: { status: 'approved' },
        }),
      ]);

      return {
        id: member.id,
        leagueId: member.leagueId,
        userId: member.userId,
        teamName: member.teamName,
        joinedAt: member.joinedAt,
        leftAt: member.leftAt,
      };
    } else {
      // Reject the request
      const updated = await this.prisma.joinRequest.update({
        where: { id: requestId },
        data: { status: 'rejected' },
      });

      return {
        id: updated.id,
        leagueId: updated.leagueId,
        userId: updated.userId,
        teamName: updated.teamName,
        status: 'rejected',
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    }
  }

  /**
   * Get league members
   */
  async getLeagueMembers(leagueId: string): Promise<LeagueMemberResponse[]> {
    const members = await this.prisma.leagueMember.findMany({
      where: {
        leagueId,
        leftAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return members.map((member) => ({
      id: member.id,
      leagueId: member.leagueId,
      userId: member.userId,
      teamName: member.teamName,
      joinedAt: member.joinedAt,
      leftAt: member.leftAt,
      user: member.user,
    }));
  }

  /**
   * Remove a member from league (commissioner only)
   */
  async removeMember(leagueId: string, memberId: string, userId: string): Promise<void> {
    // Verify user is commissioner
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        members: {
          where: { leftAt: null },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!league) {
      throw new Error('League not found');
    }

    const commissioner = league.members[0];
    if (!commissioner || commissioner.userId !== userId) {
      throw new Error('Only the commissioner can remove members');
    }

    // Get the member to remove
    const memberToRemove = await this.prisma.leagueMember.findUnique({
      where: { id: memberId },
    });

    if (!memberToRemove || memberToRemove.leagueId !== leagueId || memberToRemove.leftAt) {
      throw new Error('Member not found in this league');
    }

    // Cannot remove commissioner
    if (memberToRemove.userId === commissioner.userId) {
      throw new Error('Cannot remove the commissioner');
    }

    // Mark as left (historical picks retained)
    await this.prisma.leagueMember.update({
      where: { id: memberId },
      data: { leftAt: new Date() },
    });
  }

  /**
   * Get league by invite token (for preview before joining)
   */
  async getLeagueByInviteToken(token: string): Promise<{ league: LeagueResponse; valid: boolean; message?: string }> {
    const inviteLink = await this.prisma.inviteLink.findUnique({
      where: { token },
      include: {
        league: {
          include: {
            members: {
              where: { leftAt: null },
            },
          },
        },
        uses: true,
      },
    });

    if (!inviteLink) {
      throw new Error('Invalid invite link');
    }

    const league = inviteLink.league;
    const isExpired = new Date() > inviteLink.expiresAt;
    const isMaxedOut = inviteLink.maxUses !== null && inviteLink.uses.length >= inviteLink.maxUses;

    const leagueResponse: LeagueResponse = {
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
    };

    if (isExpired) {
      return { league: leagueResponse, valid: false, message: 'Invite link has expired' };
    }

    if (isMaxedOut) {
      return { league: leagueResponse, valid: false, message: 'Invite link has reached maximum uses' };
    }

    if (league.members.length >= league.maxPlayers) {
      return { league: leagueResponse, valid: false, message: 'League is full' };
    }

    return { league: leagueResponse, valid: true };
  }
}
