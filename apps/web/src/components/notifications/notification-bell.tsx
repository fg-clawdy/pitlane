'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, X, Check, CheckCheck, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Notification,
  getUnreadCount,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  ApiError,
} from '@/lib/api';

interface NotificationBellProps {
  token: string;
  onOpenPanel?: () => void;
}

export function NotificationBell({ token, onOpenPanel }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [isApiAvailable, setIsApiAvailable] = useState(true);

  const fetchUnreadCount = useCallback(async () => {
    // Don't make API calls without a token
    if (!token) return;
    
    try {
      const response = await getUnreadCount(token);
      setUnreadCount(response.count);
      setIsApiAvailable(true);
    } catch (error) {
      if (ApiError.isApiError(error) && error.isNetworkError) {
        // Silently handle network errors - API is unavailable
        setIsApiAvailable(false);
      } else {
        console.error('Failed to fetch unread count:', error);
      }
    }
  }, [token]);

  const fetchNotifications = useCallback(async () => {
    // Don't make API calls without a token
    if (!token) return;
    
    setLoading(true);
    try {
      const response = await getNotifications(token, { pageSize: 10 });
      setNotifications(response.notifications);
      setIsApiAvailable(true);
    } catch (error) {
      if (ApiError.isApiError(error) && error.isNetworkError) {
        setIsApiAvailable(false);
      } else {
        console.error('Failed to fetch notifications:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUnreadCount();
    // Poll for unread count every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const handleToggle = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen(!isOpen);
    onOpenPanel?.();
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(token, notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead(token);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'draft_window_open':
      case 'draft_window_closing':
      case 'draft_your_turn':
      case 'draft_completed':
        return '🏎️';
      case 'weekly_winner':
      case 'season_podium':
        return '🏆';
      case 'league_invite':
      case 'join_request_approved':
        return '🎉';
      case 'driver_substitution':
        return '🔄';
      default:
        return '📢';
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleToggle}
        className="relative h-10 w-10"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 min-w-[16px] flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Mobile Bottom Sheet / Desktop Dropdown */}
          <div className="fixed bottom-0 left-0 right-0 md:absolute md:bottom-auto md:left-auto md:right-0 md:top-full md:mt-2 md:w-80 bg-background border-t md:border md:rounded-lg shadow-lg z-50 safe-bottom">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <CheckCheck className="h-3 w-3" />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded hover:bg-muted md:hidden"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="overflow-y-auto max-h-[60vh] md:max-h-72">
              {!isApiAvailable ? (
                <div className="p-8 text-center text-muted-foreground">
                  <WifiOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">Unable to connect</p>
                  <p className="text-xs mt-1">Notifications are unavailable</p>
                </div>
              ) : loading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Loading...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-muted/50 cursor-pointer active:bg-muted transition-colors ${
                        !notification.read ? 'bg-muted/30' : ''
                      }`}
                      onClick={() => {
                        if (!notification.read) {
                          handleMarkAsRead(notification.id);
                        }
                        if (notification.data.url) {
                          setIsOpen(false);
                          window.location.href = notification.data.url;
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl flex-shrink-0">
                          {getNotificationIcon(notification.type)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-sm">
                              {notification.title}
                            </p>
                            {!notification.read && (
                              <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1.5" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {notification.body}
                          </p>
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            {formatTime(notification.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-3 border-t">
              <a
                href="/notifications"
                className="block text-center text-sm text-primary hover:underline font-medium"
                onClick={() => setIsOpen(false)}
              >
                View all notifications
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}