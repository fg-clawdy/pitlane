'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';

interface StandingsEntry {
  rank: number;
  leagueMemberId: string;
  userId: string;
  username: string;
  displayName: string | null;
  teamName: string;
  totalPoints: number;
  weeklyWins: number;
  dgeCount: number;
}

interface CurrentWeekDraftStatus {
  draftWindowId: string | null;
  raceId: string;
  raceName: string;
  round: number;
  draftStatus: 'upcoming' | 'open' | 'closed' | 'completed' | 'no_draft';
  opensAt: string | null;
  closesAt: string | null;
  currentRound: number | null;
  currentTurnMemberId: string | null;
  turnExpiresAt: string | null;
  pickedMembers: Array<{
    leagueMemberId: string;
    teamName: string;
    hasPickedRound1: boolean;
    hasPickedRound2: boolean;
  }>;
}

interface LeagueStandingsView {
  leagueId: string;
  leagueName: string;
  seasonId: string;
  seasonYear: number;
  visibility: 'public' | 'private';
  standings: StandingsEntry[];
  currentWeek: CurrentWeekDraftStatus | null;
}

interface LeagueMember {
  id: string;
  userId: string;
  teamName: string;
  isCommissioner: boolean;
  joinedAt: string;
  user: {
    id: string;
    username: string;
    displayName: string | null;
  };
}

export default function LeaguePage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params.id as string;
  
  const [token, setToken] = useState<string | null>(null);
  const [standingsView, setStandingsView] = useState<LeagueStandingsView | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = sessionStorage.getItem('token');
    if (!storedToken) {
      router.push('/login');
      return;
    }
    setToken(storedToken);
  }, [router]);

  useEffect(() => {
    if (!token) return;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch standings view
        const standingsData = await api<LeagueStandingsView>(
          `/leagues/${leagueId}/standings-view`,
          { token }
        );
        setStandingsView(standingsData);
        
        // Fetch members
        const membersData = await api<{ members: LeagueMember[] }>(
          `/leagues/${leagueId}/members`,
          { token }
        );
        setMembers(membersData.members);
      } catch (err: any) {
        setError(err.message || 'Failed to load league');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [token, leagueId]);

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  const getDraftStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      upcoming: 'bg-gray-100 text-gray-800',
      open: 'bg-green-100 text-green-800',
      closed: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-blue-100 text-blue-800',
      no_draft: 'bg-gray-100 text-gray-600',
    };
    return styles[status] || styles.no_draft;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-lg">Loading league...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-lg text-red-600">{error}</div>
        <Button onClick={() => router.push('/leagues')}>Back to Leagues</Button>
      </div>
    );
  }

  if (!standingsView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-lg">League not found</div>
        <Button onClick={() => router.push('/leagues')}>Back to Leagues</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* League Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{standingsView.leagueName}</h1>
          <p className="text-muted-foreground">
            {standingsView.seasonYear} Season • {standingsView.visibility === 'public' ? 'Public' : 'Private'} League
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/leagues/${leagueId}/draft`)}>
            View Draft Board
          </Button>
        </div>
      </div>

      {/* Current Week Status */}
      {standingsView.currentWeek && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Current Race: {standingsView.currentWeek.raceName}</span>
              <span className={`text-sm px-2 py-1 rounded-full ${getDraftStatusBadge(standingsView.currentWeek.draftStatus)}`}>
                {standingsView.currentWeek.draftStatus.replace('_', ' ').toUpperCase()}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Round</p>
                <p className="font-medium">{standingsView.currentWeek.round}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Draft Opens</p>
                <p className="font-medium">{formatDateTime(standingsView.currentWeek.opensAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Draft Closes</p>
                <p className="font-medium">{formatDateTime(standingsView.currentWeek.closesAt)}</p>
              </div>
              {standingsView.currentWeek.draftStatus === 'open' && standingsView.currentWeek.turnExpiresAt && (
                <div>
                  <p className="text-muted-foreground">Turn Expires</p>
                  <p className="font-medium text-orange-600">{formatDateTime(standingsView.currentWeek.turnExpiresAt)}</p>
                </div>
              )}
            </div>
            
            {/* Pick Progress */}
            {standingsView.currentWeek.draftStatus === 'open' && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Pick Progress</p>
                <div className="space-y-2">
                  {standingsView.currentWeek.pickedMembers.map((member) => (
                    <div key={member.leagueMemberId} className="flex items-center justify-between text-sm bg-muted/50 rounded px-3 py-2">
                      <span>{member.teamName}</span>
                      <div className="flex gap-2">
                        <span className={`px-2 py-0.5 rounded ${member.hasPickedRound1 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          R1
                        </span>
                        <span className={`px-2 py-0.5 rounded ${member.hasPickedRound2 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          R2
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Standings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Season Standings</CardTitle>
        </CardHeader>
        <CardContent>
          {standingsView.standings.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No standings yet. Complete a race to see scores.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Rank</th>
                    <th className="text-left py-3 px-2 font-medium">Team</th>
                    <th className="text-left py-3 px-2 font-medium hidden md:table-cell">Manager</th>
                    <th className="text-right py-3 px-2 font-medium">Points</th>
                    <th className="text-right py-3 px-2 font-medium hidden sm:table-cell">Wins</th>
                    <th className="text-right py-3 px-2 font-medium hidden sm:table-cell">DGE</th>
                  </tr>
                </thead>
                <tbody>
                  {standingsView.standings.map((entry) => (
                    <tr key={entry.leagueMemberId} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                          entry.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                          entry.rank === 2 ? 'bg-gray-100 text-gray-800' :
                          entry.rank === 3 ? 'bg-orange-100 text-orange-800' :
                          'text-muted-foreground'
                        }`}>
                          {entry.rank}
                        </span>
                      </td>
                      <td className="py-3 px-2 font-medium">{entry.teamName}</td>
                      <td className="py-3 px-2 hidden md:table-cell text-muted-foreground">
                        {entry.displayName || entry.username}
                      </td>
                      <td className="py-3 px-2 text-right font-bold">{entry.totalPoints}</td>
                      <td className="py-3 px-2 text-right hidden sm:table-cell">
                        {entry.weeklyWins > 0 && (
                          <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-sm">
                            {entry.weeklyWins}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right hidden sm:table-cell">
                        {entry.dgeCount > 0 && (
                          <span className="text-red-600">🥚🥚 {entry.dgeCount}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium">{member.teamName}</p>
                    <p className="text-sm text-muted-foreground">{member.user.displayName || member.user.username}</p>
                  </div>
                </div>
                {member.isCommissioner && (
                  <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">
                    Commissioner
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}