/**
 * Admin Module Types
 */

// User management types
export interface AdminUserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: 'active' | 'suspended' | 'pending_verification';
}

export interface AdminUserOutput {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  role: string;
  status: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  leagueCount: number;
}

export interface AdminUserUpdateInput {
  username?: string;
  displayName?: string;
  role?: 'user' | 'commissioner' | 'super_admin';
  status?: 'active' | 'suspended';
}

// System settings types
export interface SystemSettingOutput {
  key: string;
  value: string | number | object;
  description: string;
  updatedAt: Date;
}

export interface SystemSettingUpdateInput {
  key: string;
  value: string | number | object;
}

// Audit log types
export interface AuditLogListParams {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  entityType?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface AuditLogOutput {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string | null;
  user?: {
    id: string;
    email: string;
    username: string | null;
  };
  changes: any;
  createdAt: Date;
}

// Commissioner flag types
export interface CommissionerFlagOutput {
  id: string;
  leagueId: string;
  leagueName: string;
  flagType: string;
  description: string;
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  createdAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolution?: string;
}

export interface CommissionerFlagListParams {
  page?: number;
  limit?: number;
  status?: 'pending' | 'investigating' | 'resolved' | 'dismissed';
}

export interface CommissionerFlagUpdateInput {
  status: 'investigating' | 'resolved' | 'dismissed';
  resolution?: string;
}

// Notification log types
export interface NotificationLogListParams {
  page?: number;
  limit?: number;
  userId?: string;
  type?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface NotificationLogOutput {
  id: string;
  userId: string;
  user: {
    id: string;
    email: string;
    username: string | null;
  };
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: Date;
}

// Dashboard stats
export interface AdminDashboardStats {
  users: {
    total: number;
    active: number;
    suspended: number;
    pendingVerification: number;
    newThisWeek: number;
  };
  leagues: {
    total: number;
    active: number;
    completed: number;
  };
  races: {
    total: number;
    upcoming: number;
    completed: number;
    pendingDataSync: number;
  };
  notifications: {
    totalSent: number;
    last24Hours: number;
    failedCount: number;
  };
  flags: {
    pending: number;
    investigating: number;
  };
}