'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAdminDashboardStats, AdminDashboardStats } from '@/lib/api';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const data = await getAdminDashboardStats(token);
        setStats(data);
      } catch (err) {
        setError('Failed to load dashboard stats');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return <div className="text-center py-12">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="text-center py-12 text-red-600">{error}</div>;
  }

  if (!stats) {
    return <div className="text-center py-12">No data available</div>;
  }

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Users Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Users</h3>
            <span className="text-2xl">👥</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Total</span>
              <span className="font-semibold">{stats.users.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Active</span>
              <span className="font-semibold text-green-600">{stats.users.active}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Suspended</span>
              <span className="font-semibold text-red-600">{stats.users.suspended}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Pending</span>
              <span className="font-semibold text-yellow-600">{stats.users.pendingVerification}</span>
            </div>
            <div className="flex justify-between border-t pt-2 mt-2">
              <span className="text-gray-600">New This Week</span>
              <span className="font-semibold text-blue-600">+{stats.users.newThisWeek}</span>
            </div>
          </div>
          <Link href="/admin/users" className="mt-4 block text-sm text-blue-600 hover:underline">
            Manage Users →
          </Link>
        </div>

        {/* Leagues Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Leagues</h3>
            <span className="text-2xl">🏆</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Total</span>
              <span className="font-semibold">{stats.leagues.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Active</span>
              <span className="font-semibold text-green-600">{stats.leagues.active}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Completed</span>
              <span className="font-semibold text-gray-500">{stats.leagues.completed}</span>
            </div>
          </div>
        </div>

        {/* Races Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Races</h3>
            <span className="text-2xl">🏎️</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Total</span>
              <span className="font-semibold">{stats.races.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Upcoming</span>
              <span className="font-semibold text-blue-600">{stats.races.upcoming}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Completed</span>
              <span className="font-semibold text-green-600">{stats.races.completed}</span>
            </div>
            <div className="flex justify-between border-t pt-2 mt-2">
              <span className="text-gray-600">Pending Sync</span>
              <span className={`font-semibold ${stats.races.pendingDataSync > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {stats.races.pendingDataSync}
              </span>
            </div>
          </div>
          <Link href="/admin/races" className="mt-4 block text-sm text-blue-600 hover:underline">
            Manage Races →
          </Link>
        </div>

        {/* Notifications Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Notifications</h3>
            <span className="text-2xl">🔔</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Sent</span>
              <span className="font-semibold">{stats.notifications.totalSent}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last 24h</span>
              <span className="font-semibold text-blue-600">{stats.notifications.last24Hours}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Failed</span>
              <span className={`font-semibold ${stats.notifications.failedCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {stats.notifications.failedCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts Row */}
      {(stats.races.pendingDataSync > 0 || stats.flags.pending > 0) && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">⚠️ Alerts</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.races.pendingDataSync > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">
                  <strong>{stats.races.pendingDataSync}</strong> race(s) completed but missing results data
                </p>
                <Link href="/admin/races?hasResults=false" className="text-sm text-yellow-600 hover:underline">
                  View Races →
                </Link>
              </div>
            )}
            {stats.flags.pending > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">
                  <strong>{stats.flags.pending}</strong> commissioner flag(s) pending review
                </p>
                <Link href="/admin/flags?status=pending" className="text-sm text-red-600 hover:underline">
                  View Flags →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/admin/users?status=pending_verification"
            className="flex items-center justify-center p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors"
          >
            <span className="mr-2">🔄</span>
            <span>Verify Users</span>
          </Link>
          <Link
            href="/admin/races"
            className="flex items-center justify-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <span className="mr-2">✏️</span>
            <span>Enter Results</span>
          </Link>
          <Link
            href="/admin/settings"
            className="flex items-center justify-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <span className="mr-2">⚙️</span>
            <span>Settings</span>
          </Link>
          <Link
            href="/admin/audit"
            className="flex items-center justify-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <span className="mr-2">📝</span>
            <span>View Logs</span>
          </Link>
        </div>
      </div>
    </div>
  );
}