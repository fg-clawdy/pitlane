const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
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

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || 'API request failed');
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