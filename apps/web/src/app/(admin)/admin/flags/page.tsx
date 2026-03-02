'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  getCommissionerFlags, 
  updateCommissionerFlag,
  CommissionerFlag,
  CommissionerFlagListParams,
  CommissionerFlagUpdateDto
} from '@/lib/api';

export default function AdminFlagsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [flags, setFlags] = useState<CommissionerFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filter
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');

  // Selected flag for modal
  const [selectedFlag, setSelectedFlag] = useState<CommissionerFlag | null>(null);
  const [resolution, setResolution] = useState('');
  const [newStatus, setNewStatus] = useState<string>('');

  const fetchFlags = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setLoading(true);
    try {
      const params: CommissionerFlagListParams = {
        page,
        limit: 20,
        status: statusFilter || undefined,
      };
      
      const data = await getCommissionerFlags(token, params);
      setFlags(data.flags);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error('Failed to fetch flags:', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  // Update URL params when filter changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    router.push(`/admin/flags?${params.toString()}`, { scroll: false });
  }, [statusFilter, router]);

  const handleOpenFlag = (flag: CommissionerFlag) => {
    setSelectedFlag(flag);
    setNewStatus(flag.status);
    setResolution(flag.resolution || '');
  };

  const handleUpdateFlag = async () => {
    if (!selectedFlag) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const updateData: CommissionerFlagUpdateDto = {
        status: newStatus as CommissionerFlagUpdateDto['status'],
        resolution: resolution || undefined,
      };

      const result = await updateCommissionerFlag(token, selectedFlag.id, updateData);
      if (result.success) {
        await fetchFlags();
        setSelectedFlag(null);
      } else {
        alert(result.error || 'Failed to update flag');
      }
    } catch (err) {
      console.error('Failed to update flag:', err);
      alert('Failed to update flag');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'investigating':
        return 'bg-blue-100 text-blue-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'dismissed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getFlagTypeIcon = (flagType: string) => {
    switch (flagType) {
      case 'data_discrepancy':
        return '⚠️';
      case 'suspicious_activity':
        return '🔍';
      case 'user_report':
        return '📢';
      default:
        return '🚩';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Commissioner Flags</h2>
        <span className="text-gray-500">{total} total flags</span>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setStatusFilter('')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Clear Filter
            </button>
          </div>
        </div>
      </div>

      {/* Flags List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-12">Loading flags...</div>
        ) : flags.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No flags found</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {flags.map((flag) => (
              <div 
                key={flag.id} 
                className={`p-6 hover:bg-gray-50 cursor-pointer ${
                  flag.status === 'pending' ? 'bg-yellow-50' : ''
                }`}
                onClick={() => handleOpenFlag(flag)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className="text-2xl">{getFlagTypeIcon(flag.flagType)}</div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">{flag.leagueName}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(flag.status)}`}>
                          {flag.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        Type: {flag.flagType.replace(/_/g, ' ')}
                      </div>
                      <div className="text-sm text-gray-700 mt-2">
                        {flag.description}
                      </div>
                      <div className="text-xs text-gray-400 mt-2">
                        Created: {formatDate(flag.createdAt)}
                        {flag.resolvedAt && (
                          <span className="ml-4">
                            Resolved: {formatDate(flag.resolvedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                  >
                    Review →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing page <span className="font-medium">{page}</span> of{' '}
                  <span className="font-medium">{totalPages}</span>
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    →
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Flag Detail Modal */}
      {selectedFlag && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Review Flag</h3>
              <button
                onClick={() => setSelectedFlag(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-500">League</div>
                <div className="mt-1 text-sm">{selectedFlag.leagueName}</div>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-500">Flag Type</div>
                <div className="mt-1 text-sm flex items-center">
                  <span className="mr-2">{getFlagTypeIcon(selectedFlag.flagType)}</span>
                  {selectedFlag.flagType.replace(/_/g, ' ')}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-500">Description</div>
                <div className="mt-1 text-sm bg-gray-50 p-3 rounded">
                  {selectedFlag.description}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="pending">Pending</option>
                  <option value="investigating">Investigating</option>
                  <option value="resolved">Resolved</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Resolution Notes
                </label>
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Add notes about the resolution..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md min-h-[100px]"
                />
              </div>

              {selectedFlag.resolvedAt && (
                <div className="text-sm text-gray-500">
                  Resolved at: {formatDate(selectedFlag.resolvedAt)}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setSelectedFlag(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateFlag}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Update Flag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}