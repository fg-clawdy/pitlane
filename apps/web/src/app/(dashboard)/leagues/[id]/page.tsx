'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { Settings, ChevronLeft, Users, Trophy, Clock, Medal, Flag } from 'lucide-react';

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

interface CurrentUser {
  id: string;
  username: string;
}

export default function LeaguePage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params.id as string;
  
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [standingsView, setStandingsView] = useState<LeagueStandingsView | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = sessionStorage.getItem('accessToken') || sessionStorage.getItem('token');
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
        
        // Fetch current user
        const userData = await api<CurrentUser>('/users/me', { token });
        setCurrentUser(userData);
        
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
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
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

  const isCommissioner = currentUser && members.some(m => m.isCommissioner && m.userId === currentUser.id);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push('/leagues')}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{standingsView.leagueName}</h1>
            <p className="text-sm text-muted-foreground">
              {standingsView.seasonYear} • {standingsView.visibility}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isCommissioner && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => router.push(`/leagues/${leagueId}/settings`)}
              className="h-10 w-10"
            >
              <Settings className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Current Week Status */}
      {standingsView.currentWeek && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                <span className="font-medium">{standingsView.currentWeek.raceName}</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${getDraftStatusBadge(standingsView.currentWeek.draftStatus)}`}>
                {standingsView.currentWeek.draftStatus.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div>
                <p className="text-muted-foreground text-xs">Opens</p>
                <p className="font-medium">{formatDateTime(standingsView.currentWeek.opensAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Closes</p>
                <p className="font-medium">{formatDateTime(standingsView.currentWeek.closesAt)}</p>
              </div>
            </div>

            <Button 
              className="w-full" 
              onClick={() => router.push(`/leagues/${leagueId}/draft`)}
            >
              View Draft Board
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <Card 
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => router.push(`/leagues/${leagueId}/draft`)}
        >
          <CardContent className="p-4 text-center">
            <Trophy className="h-5 w-5 mx-auto text-primary mb-2" />
            <p className="text-sm font-medium">Draft Board</p>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => router.push(`/leagues/${leagueId}/drivers`)}
        >
          <CardContent className="p-4 text-center">
            <Flag className="h-5 w-5 mx-auto text-primary mb-2" />
            <p className="text-sm font-medium">Driver Standings</p>
          </CardContent>
        </Card>
      </div>

      {/* Standings */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Medal className="h-4 w-4" />
            Season Standings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {standingsView.standings.length === 0 ? (
            <p className="text-muted-foreground text-center py-8 px-4 text-sm">
              No standings yet. Complete a race to see scores.
            </p>
          ) : (
            <div className="divide-y">
              {standingsView.standings.slice(0, 5).map((entry) => (
                <div 
                  key={entry.leagueMemberId} 
                  className="flex items-center justify-between p-3 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                      entry.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                      entry.rank === 2 ? 'bg-gray-100 text-gray-800' :
                      entry.rank === 3 ? 'bg-orange-100 text-orange-800' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {entry.rank}
                    </span>
                    <div>
                      <p className="font-medium text-sm">{entry.teamName}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {entry.weeklyWins > 0 && (
                          <span className="text-green-600">{entry.weeklyWins}W</span>
                        )}
                        {entry.dgeCount > 0 && (
                          <span className="text-red-600">🥚{entry.dgeCount}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{entry.totalPoints}</p>
                    <p className="text-xs text-muted-foreground">pts</p>
                  </div>
                </div>
              ))}
              {standingsView.standings.length > 5 && (
                <div className="p-3 text-center">
                  <Button variant="ghost" size="sm" className="text-primary">
                    View all {standingsView.standings.length} teams
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Members ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y max-h-64 overflow-y-auto">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3">
                <div>
                  <p className="font-medium text-sm">{member.teamName}</p>
                  <p className="text-xs text-muted-foreground">
                    {member.user.displayName || member.user.username}
                  </p>
                </div>
                {member.isCommissioner && (
                  <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full">
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