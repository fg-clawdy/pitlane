/**
 * Admin Service
 * Handles admin dashboard operations
 */

import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import {
  AdminUserListParams,
  AdminUserOutput,
  AdminUserUpdateInput,
  SystemSettingOutput,
  SystemSettingUpdateInput,
  AuditLogListParams,
  AuditLogOutput,
  CommissionerFlagOutput,
  CommissionerFlagListParams,
  CommissionerFlagUpdateInput,
  NotificationLogListParams,
  NotificationLogOutput,
  AdminDashboardStats,
} from './admin.types';

const prisma = new PrismaClient();

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(): Promise<AdminDashboardStats> {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // User stats
  const [
    totalUsers,
    activeUsers,
    suspendedUsers,
    pendingVerificationUsers,
    newUsersThisWeek,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'active' } }),
    prisma.user.count({ where: { status: 'suspended' } }),
    prisma.user.count({ where: { status: 'pending_verification' } }),
    prisma.user.count({ where: { createdAt: { gte: oneWeekAgo } } }),
  ]);

  // League stats
  const [totalLeagues] = await Promise.all([
    prisma.league.count(),
  ]);

  // Race stats
  const [totalRaces, upcomingRaces, completedRaces] = await Promise.all([
    prisma.race.count(),
    prisma.race.count({ where: { date: { gt: now } } }),
    prisma.race.count({ where: { date: { lt: now } } }),
  ]);

  // Races with pending data sync (completed but no results)
  const racesWithPendingSync = await prisma.race.count({
    where: {
      date: { lt: now },
      results: { none: {} },
    },
  });

  // Notification stats
  const [totalNotifications, notificationsLast24h] = await Promise.all([
    prisma.notification.count(),
    prisma.notification.count({ where: { createdAt: { gte: oneDayAgo } } }),
  ]);

  // Commissioner flags
  const [pendingFlags] = await Promise.all([
    prisma.commissionerFlag.count({ where: { status: 'pending' } }),
  ]);

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
      suspended: suspendedUsers,
      pendingVerification: pendingVerificationUsers,
      newThisWeek: newUsersThisWeek,
    },
    leagues: {
      total: totalLeagues,
      active: totalLeagues,
      completed: 0,
    },
    races: {
      total: totalRaces,
      upcoming: upcomingRaces,
      completed: completedRaces,
      pendingDataSync: racesWithPendingSync,
    },
    notifications: {
      totalSent: totalNotifications,
      last24Hours: notificationsLast24h,
      failedCount: 0,
    },
    flags: {
      pending: pendingFlags,
      investigating: 0,
    },
  };
}

/**
 * List all users with pagination and search
 */
export async function listUsers(params: AdminUserListParams): Promise<{
  users: AdminUserOutput[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const { page = 1, limit = 20, search, role, status } = params;

  const where: any = {};
  
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { username: { contains: search, mode: 'insensitive' } },
      { displayName: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (role) {
    where.role = role;
  }

  if (status) {
    where.status = status;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: {
          select: { leagueMemberships: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      status: u.status,
      emailEnabled: u.emailEnabled,
      pushEnabled: u.pushEnabled,
      createdAt: u.createdAt,
      lastLoginAt: null,
      leagueCount: u._count.leagueMemberships,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get a single user for admin view
 */
export async function getUser(userId: string): Promise<AdminUserOutput | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: { leagueMemberships: true },
      },
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    emailEnabled: user.emailEnabled,
    pushEnabled: user.pushEnabled,
    createdAt: user.createdAt,
    lastLoginAt: null,
    leagueCount: user._count.leagueMemberships,
  };
}

/**
 * Update a user (admin)
 */
export async function updateUser(
  userId: string,
  input: AdminUserUpdateInput,
  adminUserId: string
): Promise<{ success: boolean; error?: string; user?: AdminUserOutput }> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const updateData: any = {};
    if (input.username) updateData.username = input.username;
    if (input.displayName !== undefined) updateData.displayName = input.displayName;
    if (input.status) updateData.status = input.status;
    if (input.role) updateData.role = input.role as UserRole;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        _count: {
          select: { leagueMemberships: true },
        },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'admin_user_update',
        entityType: 'User',
        entityId: userId,
        userId: adminUserId,
        changes: input as any,
      },
    });

    return {
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username,
        displayName: updatedUser.displayName,
        role: updatedUser.role,
        status: updatedUser.status,
        emailEnabled: updatedUser.emailEnabled,
        pushEnabled: updatedUser.pushEnabled,
        createdAt: updatedUser.createdAt,
        lastLoginAt: null,
        leagueCount: updatedUser._count.leagueMemberships,
      },
    };
  } catch (error) {
    console.error('[AdminService] Error updating user:', error);
    return { success: false, error: `Failed to update user: ${error}` };
  }
}

/**
 * Suspend a user
 */
export async function suspendUser(
  userId: string,
  adminUserId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  return updateUser(
    userId,
    { status: 'suspended' },
    adminUserId
  );
}

/**
 * Unsuspend a user
 */
export async function unsuspendUser(
  userId: string,
  adminUserId: string
): Promise<{ success: boolean; error?: string }> {
  return updateUser(
    userId,
    { status: 'active' },
    adminUserId
  );
}

/**
 * Get all system settings
 */
export async function getSystemSettings(): Promise<SystemSettingOutput[]> {
  const settings = await prisma.systemSetting.findMany({
    orderBy: { key: 'asc' },
  });

  return settings.map((s) => ({
    key: s.key,
    value: s.value as string | number | object,
    description: s.description || '',
    updatedAt: s.updatedAt,
  }));
}

/**
 * Get a single system setting
 */
export async function getSystemSetting(key: string): Promise<SystemSettingOutput | null> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key },
  });

  if (!setting) return null;

  return {
    key: setting.key,
    value: setting.value as string | number | object,
    description: setting.description || '',
    updatedAt: setting.updatedAt,
  };
}

/**
 * Update a system setting
 */
export async function updateSystemSetting(
  input: SystemSettingUpdateInput,
  adminUserId: string
): Promise<{ success: boolean; error?: string; setting?: SystemSettingOutput }> {
  try {
    const existing = await prisma.systemSetting.findUnique({
      where: { key: input.key },
    });

    let setting;
    if (existing) {
      setting = await prisma.systemSetting.update({
        where: { key: input.key },
        data: {
          value: input.value as any,
          updatedAt: new Date(),
        },
      });
    } else {
      setting = await prisma.systemSetting.create({
        data: {
          key: input.key,
          value: input.value as any,
        },
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'system_setting_update',
        entityType: 'SystemSetting',
        entityId: input.key,
        userId: adminUserId,
        changes: {
          oldValue: existing?.value,
          newValue: input.value,
        } as any,
      },
    });

    return {
      success: true,
      setting: {
        key: setting.key,
        value: setting.value as string | number | object,
        description: setting.description || '',
        updatedAt: setting.updatedAt,
      },
    };
  } catch (error) {
    console.error('[AdminService] Error updating setting:', error);
    return { success: false, error: `Failed to update setting: ${error}` };
  }
}

/**
 * List audit logs with filters
 */
export async function listAuditLogs(params: AuditLogListParams): Promise<{
  logs: AuditLogOutput[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const { page = 1, limit = 50, userId, action, entityType, startDate, endDate } = params;

  const where: any = {};

  if (userId) {
    where.userId = userId;
  }

  if (action) {
    where.action = { contains: action, mode: 'insensitive' };
  }

  if (entityType) {
    where.entityType = entityType;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = startDate;
    }
    if (endDate) {
      where.createdAt.lte = endDate;
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  // Get user details separately for logs that have userId
  const userIds = [...new Set(logs.filter(l => l.userId).map(l => l.userId))] as string[];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, username: true },
  });
  const userMap = new Map(users.map(u => [u.id, u]));

  return {
    logs: logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      userId: log.userId,
      user: log.userId ? userMap.get(log.userId) : undefined,
      changes: log.changes,
      createdAt: log.createdAt,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * List commissioner flags with filters
 */
export async function listCommissionerFlags(params: CommissionerFlagListParams): Promise<{
  flags: CommissionerFlagOutput[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const { page = 1, limit = 20, status } = params;

  const where: any = {};

  if (status) {
    where.status = status;
  }

  const [flags, total] = await Promise.all([
    prisma.commissionerFlag.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        league: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.commissionerFlag.count({ where }),
  ]);

  return {
    flags: flags.map((flag) => ({
      id: flag.id,
      leagueId: flag.leagueId,
      leagueName: flag.league.name,
      flagType: 'issue',
      description: flag.issue,
      status: flag.status as 'pending' | 'investigating' | 'resolved' | 'dismissed',
      createdAt: flag.createdAt,
      resolvedAt: null,
      resolvedBy: null,
      resolution: flag.notes || undefined,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Update a commissioner flag status
 */
export async function updateCommissionerFlag(
  flagId: string,
  input: CommissionerFlagUpdateInput,
  adminUserId: string
): Promise<{ success: boolean; error?: string; flag?: CommissionerFlagOutput }> {
  try {
    const flag = await prisma.commissionerFlag.findUnique({
      where: { id: flagId },
      include: {
        league: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!flag) {
      return { success: false, error: 'Flag not found' };
    }

    const updatedFlag = await prisma.commissionerFlag.update({
      where: { id: flagId },
      data: {
        status: input.status,
        notes: input.resolution,
      },
      include: {
        league: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'commissioner_flag_update',
        entityType: 'CommissionerFlag',
        entityId: flagId,
        userId: adminUserId,
        changes: input as any,
      },
    });

    return {
      success: true,
      flag: {
        id: updatedFlag.id,
        leagueId: updatedFlag.leagueId,
        leagueName: updatedFlag.league.name,
        flagType: 'issue',
        description: updatedFlag.issue,
        status: updatedFlag.status as 'pending' | 'investigating' | 'resolved' | 'dismissed',
        createdAt: updatedFlag.createdAt,
        resolvedAt: null,
        resolvedBy: null,
        resolution: updatedFlag.notes || undefined,
      },
    };
  } catch (error) {
    console.error('[AdminService] Error updating flag:', error);
    return { success: false, error: `Failed to update flag: ${error}` };
  }
}

/**
 * List notification log (notification history for admin)
 */
export async function listNotificationLog(params: NotificationLogListParams): Promise<{
  notifications: NotificationLogOutput[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const { page = 1, limit = 50, userId, type, startDate, endDate } = params;

  const where: any = {};

  if (userId) {
    where.userId = userId;
  }

  if (type) {
    where.type = type;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = startDate;
    }
    if (endDate) {
      where.createdAt.lte = endDate;
    }
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
      },
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    notifications: notifications.map((n) => ({
      id: n.id,
      userId: n.userId,
      user: n.user,
      type: n.type,
      title: n.title,
      body: n.body,
      read: n.read,
      createdAt: n.createdAt,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}