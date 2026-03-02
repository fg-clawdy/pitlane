'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  getAdminRaces, 
  getRaceForDataEntry,
  bulkEnterRaceResults,
  deleteRaceResult,
  AdminRace,
  RaceWithDrivers,
  RaceResult
} from '@/lib/api';

export default function AdminRacesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [races, setRaces] = useState<AdminRace[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filters
  const [seasonYear, setSeasonYear] = useState(searchParams.get('seasonYear') || new Date().getFullYear().toString());
  const [hasResultsFilter, setHasResultsFilter] = useState<string>(searchParams.get('hasResults') || '');

  // Race detail modal
  const [selectedRace, setSelectedRace] = useState<RaceWithDrivers | null>(null);
  const [loadingRace, setLoadingRace] = useState(false);
  const [raceResults, setRaceResults] = useState<{[driverCode: string]: { position: string; finishStatus: string; fastestLap: boolean; time: string }}>({});

  const fetchRaces = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setLoading(true);
    try {
      const data = await getAdminRaces(token, {
        page,
        limit: 20,
        seasonYear: parseInt(seasonYear),
        hasResults: hasResultsFilter ? hasResultsFilter === 'true' : undefined,
      });
      setRaces(data.races);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error('Failed to fetch races:', err);
    } finally {
      setLoading(false);
    }
  }, [page, seasonYear, hasResultsFilter]);

  useEffect(() => {
    fetchRaces();
  }, [fetchRaces]);

  const handleOpenRaceDetail = async (raceId: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setLoadingRace(true);
    try {
      const data = await getRaceForDataEntry(token, raceId);
      setSelectedRace(data);
      
      // Initialize results form with existing results or empty
      const initialResults: {[driverCode: string]: { position: string; finishStatus: string; fastestLap: boolean; time: string }} = {};
      data.drivers.forEach(d => {
        const existing = data.existingResults.find(r => r.driverId === d.driverId);
        initialResults[d.code] = existing ? {
          position: existing.position.toString(),
          finishStatus: existing.finishStatus,
          fastestLap: existing.fastestLap,
          time: existing.time || '',
        } : {
          position: '',
          finishStatus: 'Finished',
          fastestLap: false,
          time: '',
        };
      });
      setRaceResults(initialResults);
    } catch (err) {
      console.error('Failed to fetch race details:', err);
      alert('Failed to load race details');
    } finally {
      setLoadingRace(false);
    }
  };

  const handleResultChange = (driverCode: string, field: string, value: string | boolean) => {
    setRaceResults(prev => ({
      ...prev,
      [driverCode]: {
        ...prev[driverCode],
        [field]: value,
      },
    }));
  };

  const handleSaveResults = async () => {
    if (!selectedRace) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    // Build results array
    const results = Object.entries(raceResults)
      .filter(([_, r]) => r.position !== '')
      .map(([driverCode, r]) => ({
        driverCode,
        position: parseInt(r.position),
        finishStatus: r.finishStatus as 'Finished' | 'DNF' | 'DNS' | 'DSQ' | 'Other',
        fastestLap: r.fastestLap,
        time: r.time || undefined,
      }));

    if (results.length === 0) {
      alert('Please enter at least one result');
      return;
    }

    try {
      const result = await bulkEnterRaceResults(token, {
        raceId: selectedRace.id,
        results,
      });

      if (result.success) {
        alert('Results saved successfully!');
        await fetchRaces();
        setSelectedRace(null);
      } else {
        alert(result.error || 'Failed to save results');
        if (result.errors) {
          console.error('Errors:', result.errors);
        }
      }
    } catch (err) {
      console.error('Failed to save results:', err);
      alert('Failed to save results');
    }
  };

  const handleDeleteResult = async (resultId: string) => {
    if (!confirm('Are you sure you want to delete this result?')) return;
    
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const result = await deleteRaceResult(token, resultId);
      if (result.success) {
        await fetchRaces();
        if (selectedRace) {
          handleOpenRaceDetail(selectedRace.id);
        }
      } else {
        alert(result.error || 'Failed to delete result');
      }
    } catch (err) {
      console.error('Failed to delete result:', err);
      alert('Failed to delete result');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isRaceCompleted = (dateString: string) => {
    return new Date(dateString) < new Date();
  };

  // Generate year options (current year and a few back)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Race Management</h2>
        <span className="text-gray-500">{total} races</span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Season Year</label>
            <select
              value={seasonYear}
              onChange={(e) => {
                setSeasonYear(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              {yearOptions.map(year => (
                <option key={year} value={year}>{year} Season</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Results Status</label>
            <select
              value={hasResultsFilter}
              onChange={(e) => {
                setHasResultsFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">All Races</option>
              <option value="true">Has Results</option>
              <option value="false">Missing Results</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSeasonYear(currentYear.toString());
                setHasResultsFilter('');
                setPage(1);
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Races Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-12">Loading races...</div>
        ) : races.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No races found</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Round
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Race
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Results
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {races.map((race) => {
                const completed = isRaceCompleted(race.date);
                const missingResults = completed && race.resultCount === 0;
                
                return (
                  <tr key={race.id} className={`hover:bg-gray-50 ${missingResults ? 'bg-yellow-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      #{race.round}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{race.raceName}</div>
                      <div className="text-sm text-gray-500">{race.circuitName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(race.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        completed 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {completed ? 'Completed' : 'Upcoming'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        race.resultCount > 0 
                          ? 'bg-green-100 text-green-800' 
                          : completed 
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}>
                        {race.resultCount} results
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleOpenRaceDetail(race.id)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        {race.resultCount > 0 ? 'Edit Results' : 'Enter Results'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

      {/* Race Detail Modal */}
      {selectedRace && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {selectedRace.raceName} - Round {selectedRace.round}
              </h3>
              <button
                onClick={() => setSelectedRace(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {loadingRace ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <>
                {/* Existing Results */}
                {selectedRace.existingResults.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-700 mb-2">Existing Results</h4>
                    <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr>
                            <th className="text-left py-1">Pos</th>
                            <th className="text-left py-1">Driver</th>
                            <th className="text-left py-1">Status</th>
                            <th className="text-left py-1">FL</th>
                            <th className="text-right py-1">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedRace.existingResults
                            .sort((a, b) => a.position - b.position)
                            .map((result) => (
                              <tr key={result.id} className={result.adminProtected ? 'bg-blue-50' : ''}>
                                <td className="py-1">P{result.position}</td>
                                <td className="py-1">{result.driverName} ({result.driverCode})</td>
                                <td className="py-1">{result.finishStatus}</td>
                                <td className="py-1">{result.fastestLap ? '✓' : ''}</td>
                                <td className="py-1 text-right">
                                  <button
                                    onClick={() => handleDeleteResult(result.id)}
                                    className="text-red-600 hover:text-red-800 text-xs"
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Enter Results Form */}
                <div className="mb-6">
                  <h4 className="font-medium text-gray-700 mb-2">Enter/Edit Results</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm border">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-2 py-2 text-left border">Driver</th>
                          <th className="px-2 py-2 text-center border w-20">Pos</th>
                          <th className="px-2 py-2 text-center border w-32">Status</th>
                          <th className="px-2 py-2 text-center border w-16">FL</th>
                          <th className="px-2 py-2 text-center border w-24">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRace.drivers.map((driver) => (
                          <tr key={driver.driverId}>
                            <td className="px-2 py-1 border">
                              <span className="font-mono font-bold">{driver.code}</span>
                              <span className="ml-2 text-gray-500">{driver.givenName} {driver.familyName}</span>
                            </td>
                            <td className="px-2 py-1 border text-center">
                              <input
                                type="number"
                                min="1"
                                max="20"
                                value={raceResults[driver.code]?.position || ''}
                                onChange={(e) => handleResultChange(driver.code, 'position', e.target.value)}
                                className="w-16 px-2 py-1 border rounded text-center"
                                placeholder="-"
                              />
                            </td>
                            <td className="px-2 py-1 border text-center">
                              <select
                                value={raceResults[driver.code]?.finishStatus || 'Finished'}
                                onChange={(e) => handleResultChange(driver.code, 'finishStatus', e.target.value)}
                                className="px-2 py-1 border rounded text-xs"
                              >
                                <option value="Finished">Finished</option>
                                <option value="DNF">DNF</option>
                                <option value="DNS">DNS</option>
                                <option value="DSQ">DSQ</option>
                                <option value="Other">Other</option>
                              </select>
                            </td>
                            <td className="px-2 py-1 border text-center">
                              <input
                                type="checkbox"
                                checked={raceResults[driver.code]?.fastestLap || false}
                                onChange={(e) => handleResultChange(driver.code, 'fastestLap', e.target.checked)}
                                className="w-4 h-4"
                              />
                            </td>
                            <td className="px-2 py-1 border text-center">
                              <input
                                type="text"
                                value={raceResults[driver.code]?.time || ''}
                                onChange={(e) => handleResultChange(driver.code, 'time', e.target.value)}
                                className="w-20 px-2 py-1 border rounded text-xs"
                                placeholder="1:30.000"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setSelectedRace(null)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveResults}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Save Results
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}