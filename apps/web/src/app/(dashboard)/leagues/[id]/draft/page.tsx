'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';

// Types from backend
interface DraftOrderEntry {
  leagueMemberId: string;
  userId: string;
  teamName: string;
  position: number;
  round1PickOrder: number;
  round2PickOrder: number;
}

interface DraftPick {
  id: string;
  leagueMemberId: string;
  teamName: string;
  driverId: string;
  driverCode: string;
  driverName: string;
  round: number;
  pickOrder: number;
  resolutionMethod: string | null;
  submittedAt: string | null;
}

interface AvailableDriver {
  id: string;
  code: string;
  name: string;
  team: string;
  seasonPoints: number;
  lastRacePosition: number | null;
}

interface DraftWindowOutput {
  id: string;
  leagueId: string;
  raceId: string;
  raceName: string;
  round: number;
  opensAt: string;
  closesAt: string;
  status: 'upcoming' | 'open' | 'closed' | 'completed';
  currentRound: number | null;
  currentPickPosition: number | null;
  currentTurnMemberId: string | null;
  turnExpiresAt: string | null;
  draftOrder: DraftOrderEntry[];
  picks: DraftPick[];
  availableDrivers: AvailableDriver[];
}

interface LeagueMember {
  id: string;
  teamName: string;
  user: {
    id: string;
    username: string;
    displayName: string | null;
  };
}

type WSMessage = 
  | { type: 'draft_state_update'; payload: DraftWindowOutput; timestamp: string }
  | { type: 'no_active_draft'; payload: { leagueId: string }; timestamp: string }
  | { type: 'pick_submitted'; payload: any; timestamp: string }
  | { type: 'draft_completed'; payload: any; timestamp: string }
  | { type: 'pong'; timestamp: string }
  | { type: 'error'; payload: { message: string }; timestamp: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export default function DraftBoardPage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params.id as string;
  
  const [draft, setDraft] = useState<DraftWindowOutput | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsDisconnected, setWsDisconnected] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  
  // Driver selection state
  const [selectedDriver, setSelectedDriver] = useState<AvailableDriver | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  
  // Timer state
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  
  const wsRef = useRef<WebSocket | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch current user and draft data
  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const fetchData = async () => {
      try {
        // Get current user
        const user = await api<{ id: string; username: string }>('users/me', { token });
        setCurrentUserId(user.id);
        
        // Get league members to find current user's member ID
        const membersData = await api<{ members: LeagueMember[] }>(`leagues/${leagueId}/members`, { token });
        setMembers(membersData.members);
        
        const myMember = membersData.members.find((m: LeagueMember) => m.user.id === user.id);
        if (myMember) {
          setCurrentMemberId(myMember.id);
        }
        
        // Get current draft
        const draftData = await api<DraftWindowOutput>(`leagues/${leagueId}/drafts/current`, { token });
        setDraft(draftData);
        
        setLoading(false);
      } catch (err: any) {
        if (err.message?.includes('404') || err.message?.includes('No active draft')) {
          setError('No active draft for this league');
        } else {
          setError(err.message || 'Failed to load draft');
        }
        setLoading(false);
      }
    };

    fetchData();
  }, [leagueId, router]);

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    const token = sessionStorage.getItem('token');
    if (!token) return;

    const wsUrl = API_URL.replace('/api/v1', '').replace('http', 'ws');
    const ws = new WebSocket(`${wsUrl}/ws/leagues/${leagueId}/draft`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
      setWsConnected(true);
      setWsDisconnected(false);
      
      // Stop polling if reconnected
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        
        switch (message.type) {
          case 'draft_state_update':
            setDraft(message.payload);
            break;
          case 'no_active_draft':
            setError('No active draft window');
            break;
          case 'pick_submitted':
          case 'draft_completed':
            // These will trigger draft_state_update anyway
            break;
          case 'error':
            console.error('[WS] Error:', message.payload.message);
            break;
        }
      } catch (err) {
        console.error('[WS] Failed to parse message:', err);
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      setWsConnected(false);
      setWsDisconnected(true);
      
      // Start polling fallback
      if (!pollingRef.current) {
        pollingRef.current = setInterval(fetchDraftState, 10000);
      }
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
    };
  }, [leagueId]);

  // Fetch draft state (for polling fallback)
  const fetchDraftState = useCallback(async () => {
    const token = sessionStorage.getItem('token');
    if (!token) return;

    try {
      const draftData = await api<DraftWindowOutput>(`leagues/${leagueId}/drafts/current`, { token });
      setDraft(draftData);
    } catch (err) {
      console.error('Failed to fetch draft state:', err);
    }
  }, [leagueId]);

  // Connect WebSocket on mount
  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [connectWebSocket]);

  // Timer countdown
  useEffect(() => {
    const updateTimer = () => {
      if (!draft?.turnExpiresAt) {
        setTimeRemaining('');
        return;
      }

      const expires = new Date(draft.turnExpiresAt).getTime();
      const now = Date.now();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeRemaining('Expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${seconds}s`);
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [draft?.turnExpiresAt]);

  // Submit pick
  const handleSubmitPick = async () => {
    if (!selectedDriver || !draft || !currentMemberId) return;

    const token = sessionStorage.getItem('token');
    if (!token) return;

    setSubmitting(true);
    try {
      await api(`drafts/${draft.id}/picks`, {
        method: 'POST',
        body: {
          leagueMemberId: currentMemberId,
          driverId: selectedDriver.id,
        },
        token,
      });
      
      setSelectedDriver(null);
      setConfirmModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to submit pick');
    } finally {
      setSubmitting(false);
    }
  };

  // Check if it's the current user's turn
  const isMyTurn = draft?.currentTurnMemberId === currentMemberId;

  // Get drafted drivers by round
  const getPicksByRound = (round: number) => {
    return draft?.picks.filter(p => p.round === round) || [];
  };

  // Get pick for a member in a round
  const getPickForMember = (memberId: string, round: number) => {
    return draft?.picks.find(p => p.leagueMemberId === memberId && p.round === round);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading draft board...</div>
      </div>
    );
  }

  if (error && !draft) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">{error}</p>
            <Button onClick={() => router.push(`/leagues/${leagueId}`)} className="w-full mt-4">
              Back to League
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">No draft data available</p>
            <Button onClick={() => router.push(`/leagues/${leagueId}`)} className="w-full mt-4">
              Back to League
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      {/* Disconnect Banner */}
      {wsDisconnected && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4 rounded">
          <p className="font-medium">WebSocket Disconnected</p>
          <p className="text-sm">Using polling fallback (10s interval). Updates may be delayed.</p>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{draft.raceName} Draft</h1>
          <p className="text-muted-foreground">
            Status: <span className="capitalize font-medium">{draft.status}</span>
            {draft.status === 'open' && draft.currentRound && (
              <> • Round {draft.currentRound}</>
            )}
          </p>
        </div>
        <div className="text-right">
          {draft.status === 'open' && timeRemaining && (
            <div className="text-lg font-mono">
              <span className="text-muted-foreground">Time Remaining: </span>
              <span className={timeRemaining === 'Expired' ? 'text-red-600' : 'text-green-600'}>
                {timeRemaining}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            {wsConnected ? 'Live' : 'Polling'}
          </div>
        </div>
      </div>

      {/* Current Turn Banner */}
      {draft.status === 'open' && (
        <Card className={`mb-6 ${isMyTurn ? 'border-green-500 border-2' : ''}`}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Turn</p>
                <p className="text-lg font-semibold">
                  {draft.draftOrder.find(d => d.leagueMemberId === draft.currentTurnMemberId)?.teamName || 'Waiting...'}
                </p>
              </div>
              {draft.currentPickPosition && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Pick #{draft.currentPickPosition}</p>
                  <p className="text-sm">Round {draft.currentRound}</p>
                </div>
              )}
            </div>
            {isMyTurn && (
              <p className="mt-2 text-green-600 font-medium">Your turn! Select a driver below.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Draft Order & Picks Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Round 1 Picks */}
        <Card>
          <CardHeader>
            <CardTitle>Round 1 Picks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {draft.draftOrder
                .sort((a, b) => a.round1PickOrder - b.round1PickOrder)
                .map((entry, idx) => {
                  const pick = getPickForMember(entry.leagueMemberId, 1);
                  const isCurrentTurn = draft.status === 'open' && 
                    draft.currentRound === 1 && 
                    draft.currentTurnMemberId === entry.leagueMemberId;
                  
                  return (
                    <div 
                      key={entry.leagueMemberId}
                      className={`flex items-center justify-between p-2 rounded ${
                        isCurrentTurn ? 'bg-green-100 border border-green-300' : 'bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground w-6">{idx + 1}.</span>
                        <span className="font-medium">{entry.teamName}</span>
                        {entry.leagueMemberId === currentMemberId && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">You</span>
                        )}
                      </div>
                      <div className="text-right">
                        {pick ? (
                          <div>
                            <span className="font-mono font-medium">{pick.driverCode}</span>
                            <span className="text-sm text-muted-foreground ml-2">{pick.driverName}</span>
                          </div>
                        ) : isCurrentTurn ? (
                          <span className="text-green-600 text-sm">Picking...</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>

        {/* Round 2 Picks */}
        <Card>
          <CardHeader>
            <CardTitle>Round 2 Picks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {draft.draftOrder
                .sort((a, b) => a.round2PickOrder - b.round2PickOrder)
                .map((entry, idx) => {
                  const pick = getPickForMember(entry.leagueMemberId, 2);
                  const isCurrentTurn = draft.status === 'open' && 
                    draft.currentRound === 2 && 
                    draft.currentTurnMemberId === entry.leagueMemberId;
                  
                  return (
                    <div 
                      key={entry.leagueMemberId}
                      className={`flex items-center justify-between p-2 rounded ${
                        isCurrentTurn ? 'bg-green-100 border border-green-300' : 'bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground w-6">{idx + 1}.</span>
                        <span className="font-medium">{entry.teamName}</span>
                        {entry.leagueMemberId === currentMemberId && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">You</span>
                        )}
                      </div>
                      <div className="text-right">
                        {pick ? (
                          <div>
                            <span className="font-mono font-medium">{pick.driverCode}</span>
                            <span className="text-sm text-muted-foreground ml-2">{pick.driverName}</span>
                          </div>
                        ) : isCurrentTurn ? (
                          <span className="text-green-600 text-sm">Picking...</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Drivers */}
      {draft.status === 'open' && isMyTurn && (
        <Card>
          <CardHeader>
            <CardTitle>Available Drivers ({draft.availableDrivers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {draft.availableDrivers.map((driver) => (
                <button
                  key={driver.id}
                  onClick={() => {
                    setSelectedDriver(driver);
                    setConfirmModal(true);
                  }}
                  disabled={submitting}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    selectedDriver?.id === driver.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-mono font-bold text-lg">{driver.code}</div>
                  <div className="text-sm text-muted-foreground truncate">{driver.name}</div>
                  <div className="text-xs text-muted-foreground">{driver.team}</div>
                  <div className="flex justify-between mt-1 text-xs">
                    <span>{driver.seasonPoints} pts</span>
                    {driver.lastRacePosition && (
                      <span>P{driver.lastRacePosition}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed Draft Summary */}
      {draft.status === 'completed' && (
        <Card>
          <CardHeader>
            <CardTitle>Draft Complete</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              The draft for {draft.raceName} has been completed. All picks are locked.
            </p>
            <Button onClick={() => router.push(`/leagues/${leagueId}`)}>
              Back to League
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Modal */}
      {confirmModal && selectedDriver && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Confirm Pick</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                Are you sure you want to draft:
              </p>
              <div className="bg-muted p-4 rounded-lg mb-4">
                <div className="font-mono font-bold text-xl">{selectedDriver.code}</div>
                <div className="text-muted-foreground">{selectedDriver.name}</div>
                <div className="text-sm text-muted-foreground">{selectedDriver.team}</div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setConfirmModal(false);
                    setSelectedDriver(null);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmitPick}
                  disabled={submitting}
                  className="flex-1"
                >
                  {submitting ? 'Submitting...' : 'Confirm Pick'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}