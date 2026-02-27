'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Notification,
  NotificationType,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/lib/api';

const NOTIFICATION_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'draft', label: 'Draft' },
  { value: 'league', label: 'League' },
  { value: 'results', label: 'Results' },
];

const TYPE_CATEGORIES: Record<string, NotificationType[]> = {
  draft: [
    'draft_window_open',
    'draft_window_closing',
    'draft_your_turn',
    'draft_pick_expired',
    'draft_completed',
    'driver_substitution',
  ],
  league: [
    'league_invite',
    'join_request_received',
    'join_request_approved',
    'removed_from_league',
  ],
  results: ['weekly_winner', 'season_podium'],
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [token, setToken] = useState('');

  // Get token from sessionStorage on client side only
  useEffect(() => {
    setToken(sessionStorage.getItem('accessToken') || '');
  }, []);

  const fetchNotifications = useCallback(
    async (pageNum: number, filterValue: string, append = false) => {
      if (!token) return;
      setLoading(true);
      try {
        const params: {
          page: number;
          pageSize: number;
          unreadOnly?: boolean;
          type?: NotificationType;
        } = { page: pageNum, pageSize: 50 };

        if (filterValue === 'unread') {
          params.unreadOnly = true;
        } else if (filterValue !== 'all') {
          // For category filters, we need to fetch all and filter client-side
          // since backend only supports single type filter
        }

        const response = await getNotifications(token, params);

        let filtered = response.notifications;
        if (filterValue !== 'all' && filterValue !== 'unread') {
          const categoryTypes = TYPE_CATEGORIES[filterValue] || [];
          filtered = response.notifications.filter((n) =>
            categoryTypes.includes(n.type)
          );
        }

        if (append) {
          setNotifications((prev) => [...prev, ...filtered]);
        } else {
          setNotifications(filtered);
        }
        setTotal(response.total);
        setHasMore(response.hasMore);
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token) return;
    setPage(1);
    fetchNotifications(1, filter);
  }, [filter, token, fetchNotifications]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNotifications(nextPage, filter, true);
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(token, notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setTotal((prev) => prev - 1);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead(token);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setTotal(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'draft_window_open':
        return '🟢';
      case 'draft_window_closing':
        return '⏰';
      case 'draft_your_turn':
        return '🏎️';
      case 'draft_pick_expired':
        return '⚠️';
      case 'draft_completed':
        return '✅';
      case 'driver_substitution':
        return '🔄';
      case 'league_invite':
        return '✉️';
      case 'join_request_received':
        return '📨';
      case 'join_request_approved':
        return '🎉';
      case 'removed_from_league':
        return '🚫';
      case 'weekly_winner':
        return '🏆';
      case 'season_podium':
        return '🥇';
      case 'email_verification':
        return '📧';
      case 'password_reset':
        return '🔑';
      case 'email_change_request':
      case 'email_change_complete':
        return '🔄';
      default:
        return '📢';
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {total > 0 && (
          <Button variant="outline" onClick={handleMarkAllAsRead}>
            Mark all as read
          </Button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {NOTIFICATION_FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={filter === f.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {filter === 'all'
              ? `All notifications (${total})`
              : filter === 'unread'
              ? `${total} unread`
              : `${filter} notifications`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                    !notification.read ? 'bg-muted/20' : ''
                  }`}
                  onClick={() => {
                    if (!notification.read) {
                      handleMarkAsRead(notification.id);
                    }
                    if (notification.data.url) {
                      window.location.href = notification.data.url;
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">
                      {getNotificationIcon(notification.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`font-medium ${
                            !notification.read ? 'text-foreground' : 'text-muted-foreground'
                          }`}
                        >
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.body}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatTime(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {hasMore && (
        <div className="text-center">
          <Button variant="outline" onClick={handleLoadMore} disabled={loading}>
            {loading ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}