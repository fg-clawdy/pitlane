const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
}

export class ApiError extends Error {
  public readonly isNetworkError: boolean;
  public readonly statusCode?: number;

  constructor(
    message: string,
    isNetworkError: boolean = false,
    statusCode?: number
  ) {
    super(message);
    this.name = 'ApiError';
    this.isNetworkError = isNetworkError;
    this.statusCode = statusCode;
  }

  static isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError || 
      (typeof error === 'object' && error !== null && 'isNetworkError' in error);
  }
}

export async function api<T>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {}, token } = options;

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  if (body) {
    config.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  } catch (error) {
    // Handle network errors (connection refused, timeout, etc.)
    throw new ApiError(
      'Unable to connect to the server. Please check if the API is running.',
      true
    );
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    
    // Handle authentication errors - redirect to login only if a token was provided
    // (don't redirect if no token was sent, as that's a different issue)
    if (response.status === 401 && token) {
      // Clear stored tokens
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('accessToken');
        // Redirect to login page
        window.location.href = '/login';
      }
      throw new ApiError('Session expired. Redirecting to login...', false, response.status);
    }
    
    throw new ApiError(
      error.error || error.message || 'API request failed',
      false,
      response.status
    );
  }

  return response.json();
}

// Notification types matching backend
export type NotificationType =
  | 'email_verification'
  | 'password_reset'
  | 'email_change_request'
  | 'email_change_complete'
  | 'draft_window_open'
  | 'draft_window_closing'
  | 'draft_your_turn'
  | 'draft_pick_expired'
  | 'draft_completed'
  | 'driver_substitution'
  | 'league_invite'
  | 'join_request_received'
  | 'join_request_approved'
  | 'removed_from_league'
  | 'weekly_winner'
  | 'season_podium'
  | 'data_discrepancy'
  | 'commissioner_flag';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, string | null>;
  read: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface UnreadCountResponse {
  count: number;
}

// Notification API functions
export async function getNotifications(
  token: string,
  params?: { page?: number; pageSize?: number; unreadOnly?: boolean; type?: NotificationType }
): Promise<NotificationsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString());
  if (params?.unreadOnly) searchParams.set('unreadOnly', 'true');
  if (params?.type) searchParams.set('type', params.type);
  
  const query = searchParams.toString();
  return api<NotificationsResponse>(`/notifications${query ? `?${query}` : ''}`, { token });
}

export async function getUnreadCount(token: string): Promise<UnreadCountResponse> {
  return api<UnreadCountResponse>('/notifications/unread-count', { token });
}

export async function markNotificationAsRead(token: string, notificationId: string): Promise<void> {
  return api(`/notifications/${notificationId}/read`, { method: 'PATCH', token });
}

export async function markAllNotificationsAsRead(token: string): Promise<void> {
  return api('/notifications/read-all', { method: 'POST', token });
}

// User profile types
export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  defaultTeamName: string | null;
  emailEnabled: boolean;
  pushEnabled: boolean;
  status: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileDto {
  username?: string;
  displayName?: string;
  defaultTeamName?: string;
  emailEnabled?: boolean;
  pushEnabled?: boolean;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface EmailChangeStatus {
  hasPendingRequest: boolean;
  request: {
    id: string;
    newEmail: string;
    currentEmail: string;
    expiresAt: string;
    holdPeriodSeconds: number;
    canWaive: boolean;
  } | null;
}

export interface EmailChangeRequestDto {
  newEmail: string;
  password: string;
}

// User API functions
export async function getMe(token: string): Promise<UserProfile> {
  return api<UserProfile>('/users/me', { token });
}

export async function updateProfile(token: string, data: UpdateProfileDto): Promise<UserProfile> {
  return api<UserProfile>('/users/me', { method: 'PATCH', body: data, token });
}

export async function changePassword(token: string, data: ChangePasswordDto): Promise<void> {
  return api('/users/me/password', { method: 'POST', body: data, token });
}

export async function getEmailChangeStatus(token: string): Promise<EmailChangeStatus> {
  return api<EmailChangeStatus>('/users/me/email-change', { token });
}

export async function requestEmailChange(token: string, data: EmailChangeRequestDto): Promise<void> {
  return api('/users/me/email-change', { method: 'POST', body: data, token });
}

export async function cancelEmailChange(token: string): Promise<void> {
  return api('/users/me/email-change/cancel', { method: 'POST', token });
}

export async function waiveHoldEmailChange(token: string): Promise<void> {
  return api('/users/me/email-change/waive-hold', { method: 'POST', token });
}

export async function getVapidPublicKey(): Promise<{ publicKey: string }> {
  return api('/users/vapid-public-key');
}

export async function registerPushSubscription(token: string, subscription: { endpoint: string; p256dh: string; auth: string }): Promise<void> {
  return api('/users/me/push-subscription', { method: 'POST', body: subscription, token });
}

export async function removePushSubscription(token: string): Promise<void> {
  return api('/users/me/push-subscription', { method: 'DELETE', token });
}

// ========== ADMIN API TYPES ==========

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

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  role: string;
  status: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  leagueCount: number;
}

export interface AdminUserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
}

export interface AdminUserListResponse {
  users: AdminUser[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AdminUserUpdateDto {
  username?: string;
  displayName?: string;
  status?: string;
  role?: string;
}

export interface SystemSetting {
  key: string;
  value: string | number | boolean | object;
  description: string;
  updatedAt: string;
}

export interface SystemSettingUpdateDto {
  key: string;
  value: string | number | object | boolean;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string | null;
  user?: {
    id: string;
    email: string;
    username: string;
  };
  changes: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogListParams {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  entityType?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditLogListResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CommissionerFlag {
  id: string;
  leagueId: string;
  leagueName: string;
  flagType: string;
  description: string;
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolution?: string;
}

export interface CommissionerFlagListParams {
  page?: number;
  limit?: number;
  status?: string;
}

export interface CommissionerFlagListResponse {
  flags: CommissionerFlag[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CommissionerFlagUpdateDto {
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  resolution?: string;
}

export interface AdminRace {
  id: string;
  raceName: string;
  round: number;
  date: string;
  seasonYear: number;
  circuitName: string;
  resultCount: number;
}

export interface AdminRaceListParams {
  page?: number;
  limit?: number;
  seasonYear?: number;
  hasResults?: boolean;
}

export interface AdminRaceListResponse {
  races: AdminRace[];
  total: number;
  page: number;
  totalPages: number;
}

export interface RaceDriver {
  id: string;
  driverId: string;
  code: string;
  givenName: string;
  familyName: string;
  permanentNumber: string;
}

export interface RaceResult {
  id: string;
  raceId: string;
  raceName: string;
  driverId: string;
  driverCode: string;
  driverName: string;
  position: number;
  points: number;
  status: string;
  finishStatus: 'Finished' | 'DNF' | 'DNS' | 'DSQ' | 'Other';
  fastestLap: boolean;
  time?: string;
  adminProtected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RaceWithDrivers {
  id: string;
  raceName: string;
  round: number;
  date: string;
  seasonYear: number;
  drivers: RaceDriver[];
  existingResults: RaceResult[];
}

export interface ManualRaceResultDto {
  raceId: string;
  driverId: string;
  position: number;
  finishStatus: 'Finished' | 'DNF' | 'DNS' | 'DSQ' | 'Other';
  fastestLap?: boolean;
  time?: string;
  points?: number;
  adminProtected?: boolean;
  notes?: string;
}

export interface BulkRaceResultDto {
  raceId: string;
  results: Array<{
    driverCode: string;
    position: number;
    finishStatus: 'Finished' | 'DNF' | 'DNS' | 'DSQ' | 'Other';
    fastestLap?: boolean;
    time?: string;
  }>;
}

// ========== ADMIN API FUNCTIONS ==========

const ADMIN_API_BASE = '/admin';

export async function getAdminDashboardStats(token: string): Promise<AdminDashboardStats> {
  return api<AdminDashboardStats>(`${ADMIN_API_BASE}/dashboard`, { token });
}

export async function getAdminUsers(token: string, params?: AdminUserListParams): Promise<AdminUserListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.search) searchParams.set('search', params.search);
  if (params?.role) searchParams.set('role', params.role);
  if (params?.status) searchParams.set('status', params.status);
  
  const query = searchParams.toString();
  return api<AdminUserListResponse>(`${ADMIN_API_BASE}/users${query ? `?${query}` : ''}`, { token });
}

export async function getAdminUser(token: string, userId: string): Promise<AdminUser> {
  return api<AdminUser>(`${ADMIN_API_BASE}/users/${userId}`, { token });
}

export async function updateAdminUser(token: string, userId: string, data: AdminUserUpdateDto): Promise<{ success: boolean; user?: AdminUser; error?: string }> {
  return api(`${ADMIN_API_BASE}/users/${userId}`, { method: 'PATCH', body: data, token });
}

export async function suspendAdminUser(token: string, userId: string, reason: string): Promise<{ success: boolean; error?: string }> {
  return api(`${ADMIN_API_BASE}/users/${userId}/suspend`, { method: 'POST', body: { reason }, token });
}

export async function unsuspendAdminUser(token: string, userId: string): Promise<{ success: boolean; error?: string }> {
  return api(`${ADMIN_API_BASE}/users/${userId}/unsuspend`, { method: 'POST', token });
}

export async function getSystemSettings(token: string): Promise<SystemSetting[]> {
  return api<SystemSetting[]>(`${ADMIN_API_BASE}/settings`, { token });
}

export async function updateSystemSetting(token: string, data: SystemSettingUpdateDto): Promise<{ success: boolean; setting?: SystemSetting; error?: string }> {
  return api(`${ADMIN_API_BASE}/settings`, { method: 'PATCH', body: data, token });
}

export async function getAuditLogs(token: string, params?: AuditLogListParams): Promise<AuditLogListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.userId) searchParams.set('userId', params.userId);
  if (params?.action) searchParams.set('action', params.action);
  if (params?.entityType) searchParams.set('entityType', params.entityType);
  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);
  
  const query = searchParams.toString();
  return api<AuditLogListResponse>(`${ADMIN_API_BASE}/audit${query ? `?${query}` : ''}`, { token });
}

export async function getCommissionerFlags(token: string, params?: CommissionerFlagListParams): Promise<CommissionerFlagListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.status) searchParams.set('status', params.status);
  
  const query = searchParams.toString();
  return api<CommissionerFlagListResponse>(`${ADMIN_API_BASE}/flags${query ? `?${query}` : ''}`, { token });
}

export async function updateCommissionerFlag(token: string, flagId: string, data: CommissionerFlagUpdateDto): Promise<{ success: boolean; flag?: CommissionerFlag; error?: string }> {
  return api(`${ADMIN_API_BASE}/flags/${flagId}`, { method: 'PATCH', body: data, token });
}

export async function getAdminRaces(token: string, params?: AdminRaceListParams): Promise<AdminRaceListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.seasonYear) searchParams.set('seasonYear', params.seasonYear.toString());
  if (params?.hasResults !== undefined) searchParams.set('hasResults', params.hasResults.toString());
  
  const query = searchParams.toString();
  return api<AdminRaceListResponse>(`${ADMIN_API_BASE}/races${query ? `?${query}` : ''}`, { token });
}

export async function getRaceForDataEntry(token: string, raceId: string): Promise<RaceWithDrivers> {
  return api<RaceWithDrivers>(`${ADMIN_API_BASE}/races/${raceId}`, { token });
}

export async function enterRaceResult(token: string, data: ManualRaceResultDto): Promise<{ success: boolean; result?: RaceResult; error?: string }> {
  return api(`${ADMIN_API_BASE}/races/results`, { method: 'POST', body: data, token });
}

export async function bulkEnterRaceResults(token: string, data: BulkRaceResultDto): Promise<{ success: boolean; results?: RaceResult[]; errors?: string[]; error?: string }> {
  return api(`${ADMIN_API_BASE}/races/results/bulk`, { method: 'POST', body: data, token });
}

export async function deleteRaceResult(token: string, resultId: string): Promise<{ success: boolean; error?: string }> {
  return api(`${ADMIN_API_BASE}/races/results/${resultId}`, { method: 'DELETE', token });
}

// ========== PUBLIC F1 DATA API TYPES ==========

export interface Season {
  id: string;
  year: number;
  createdAt: string;
  updatedAt: string;
  races: Race[];
}

export interface Race {
  id: string;
  seasonId: string;
  round: number;
  raceName: string;
  circuitName: string;
  date: string;
  time: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Driver {
  id: string;
  driverId: string;
  permanentNumber: number | null;
  code: string;
  givenName: string;
  familyName: string;
  nationality: string;
  dateOfBirth: string;
  seasonId: string;
  teamId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  teamId: string;
  name: string;
  fullName: string;
  nationality: string;
  url: string | null;
  seasonId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RaceResultPublic {
  id: string;
  raceId: string;
  driverId: string;
  position: number;
  points: number;
  status: string;
  time: string | null;
  fastestLap: boolean;
  driver: {
    id: string;
    code: string;
    givenName: string;
    familyName: string;
    permanentNumber: number | null;
    nationality: string;
  };
}

export interface LeagueDriverStanding {
  position: number;
  driverId: string;
  driverCode: string;
  driverName: string;
  driverNumber: string;
  nationality: string;
  totalPoints: number;
  racesStarted: number;
  wins: number;
  podiums: number;
  fastestLaps: number;
  dnfs: number;
  raceResults: Array<{
    raceId: string;
    raceName: string;
    round: number;
    position: number;
    status: string;
    points: number;
    fastestLap: boolean;
  }>;
}

// ========== PUBLIC F1 DATA API FUNCTIONS ==========

export async function getSeasons(): Promise<Season[]> {
  return api<Season[]>('/seasons');
}

export async function getRacesBySeason(year: number): Promise<Race[]> {
  return api<Race[]>(`/seasons/${year}/races`);
}

export async function getRace(year: number, round: number): Promise<Race> {
  return api<Race>(`/seasons/${year}/races/${round}`);
}

export async function getRaceResultsPublic(year: number, round: number): Promise<RaceResultPublic[]> {
  return api<RaceResultPublic[]>(`/seasons/${year}/races/${round}/results`);
}

export async function getDriversBySeason(year: number): Promise<Driver[]> {
  return api<Driver[]>(`/seasons/${year}/drivers`);
}

export async function getLeagueDriverStandings(leagueId: string): Promise<{ driverStandings: LeagueDriverStanding[] }> {
  return api<{ driverStandings: LeagueDriverStanding[] }>(`/leagues/${leagueId}/driver-standings`);
}

export async function getTeamsBySeason(year: number): Promise<Team[]> {
  return api<Team[]>(`/seasons/${year}/teams`);
}

export async function getAllTeams(): Promise<Team[]> {
  return api<Team[]>('/teams');
}
