'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { ChevronLeft, Clock, Wifi, WifiOff, Check, X, Users } from 'lucide-react';

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
  
  // View state for mobile
  const [activeTab, setActiveTab] = useState<'round1' | 'round2' | 'drivers'>('round1');
  
  // Timer state
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  
  const wsRef = useRef<WebSocket | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch current user and draft data
  useEffect(() => {
    const token = sessionStorage.getItem('accessToken') || sessionStorage.getItem('token');
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
    const token = sessionStorage.getItem('accessToken') || sessionStorage.getItem('token');
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

  // Get pick for a member in a round
  const getPickForMember = (memberId: string, round: number) => {
    return draft?.picks.find(p => p.leagueMemberId === memberId && p.round === round);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Loading draft board...</p>
      </div>
    );
  }

  if (error && !draft) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">{error}</p>
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">No draft data available</p>
            <Button onClick={() => router.push(`/leagues/${leagueId}`)} className="w-full mt-4">
              Back to League
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentTeamTurn = draft.draftOrder.find(d => d.leagueMemberId === draft.currentTurnMemberId);

  return (
    <div className="space-y-4">
      {/* Disconnect Banner */}
      {wsDisconnected && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-3 text-sm">
          <p className="font-medium">Connection lost - using polling</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push(`/leagues/${leagueId}`)}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{draft.raceName}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="capitalize">{draft.status}</span>
              {draft.status === 'open' && draft.currentRound && (
                <>• Round {draft.currentRound}</>
              )}
              <span className="flex items-center gap-1">
                {wsConnected ? (
                  <Wifi className="h-3 w-3 text-green-500" />
                ) : (
                  <WifiOff className="h-3 w-3 text-yellow-500" />
                )}
              </span>
            </div>
          </div>
        </div>
        {draft.status === 'open' && timeRemaining && (
          <div className="text-right">
            <div className="flex items-center gap-1 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className={timeRemaining === 'Expired' ? 'text-red-600 font-medium' : 'font-mono'}>
                {timeRemaining}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Current Turn Banner */}
      {draft.status === 'open' && (
        <Card className={`${isMyTurn ? 'border-green-500 border-2 bg-green-50' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Current Turn</p>
                <p className="font-semibold text-lg">
                  {currentTeamTurn?.teamName || 'Waiting...'}
                </p>
              </div>
              {draft.currentPickPosition && (
                <div className="text-right">
                  <p className="text-2xl font-bold">#{draft.currentPickPosition}</p>
                  <p className="text-xs text-muted-foreground">Round {draft.currentRound}</p>
                </div>
              )}
            </div>
            {isMyTurn && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-green-700 font-medium text-sm">🎉 Your turn! Select a driver below.</p>
                <Button 
                  className="w-full mt-2"
                  onClick={() => setActiveTab('drivers')}
                >
                  Pick Your Driver
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab Navigation for Mobile */}
      <div className="flex border rounded-lg overflow-hidden">
        <button
          onClick={() => setActiveTab('round1')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'round1' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
          }`}
        >
          Round 1
        </button>
        <button
          onClick={() => setActiveTab('round2')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'round2' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
          }`}
        >
          Round 2
        </button>
        {draft.status === 'open' && isMyTurn && (
          <button
            onClick={() => setActiveTab('drivers')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'drivers' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
            }`}
          >
            Pick Driver
          </button>
        )}
      </div>

      {/* Tab Content */}
      {(activeTab === 'round1' || activeTab === 'round2') && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {activeTab === 'round1' ? 'Round 1' : 'Round 2'} Picks
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {draft.draftOrder
                .sort((a, b) => 
                  activeTab === 'round1' 
                    ? a.round1PickOrder - b.round1PickOrder 
                    : a.round2PickOrder - b.round2PickOrder
                )
                .map((entry, idx) => {
                  const round = activeTab === 'round1' ? 1 : 2;
                  const pick = getPickForMember(entry.leagueMemberId, round);
                  const isCurrentTurn = draft.status === 'open' && 
                    draft.currentRound === round && 
                    draft.currentTurnMemberId === entry.leagueMemberId;
                  
                  return (
                    <div 
                      key={entry.leagueMemberId}
                      className={`flex items-center justify-between p-3 ${
                        isCurrentTurn ? 'bg-green-100' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isCurrentTurn ? 'bg-green-500 text-white' : 'bg-muted'
                        }`}>
                          {idx + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{entry.teamName}</span>
                            {entry.leagueMemberId === currentMemberId && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">You</span>
                            )}
                          </div>
                          {isCurrentTurn && (
                            <span className="text-xs text-green-600">Picking now...</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {pick ? (
                          <div>
                            <span className="font-mono font-bold">{pick.driverCode}</span>
                            <span className="text-xs text-muted-foreground block">{pick.driverName}</span>
                          </div>
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
      )}

      {/* Available Drivers */}
      {activeTab === 'drivers' && draft.status === 'open' && isMyTurn && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Available Drivers</h2>
            <span className="text-sm text-muted-foreground">{draft.availableDrivers.length} left</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {draft.availableDrivers.map((driver) => (
              <button
                key={driver.id}
                onClick={() => {
                  setSelectedDriver(driver);
                  setConfirmModal(true);
                }}
                disabled={submitting}
                className={`p-3 rounded-lg border text-left transition-all active:scale-[0.98] ${
                  selectedDriver?.id === driver.id 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-primary/50 bg-card'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono font-bold text-lg">{driver.code}</div>
                    <div className="text-xs text-muted-foreground truncate">{driver.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-medium">{driver.seasonPoints} pts</div>
                    {driver.lastRacePosition && (
                      <div className="text-xs text-muted-foreground">P{driver.lastRacePosition}</div>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1 truncate">{driver.team}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Completed Draft Summary */}
      {draft.status === 'completed' && (
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-lg font-medium mb-2">Draft Complete!</p>
            <p className="text-sm text-muted-foreground mb-4">
              All picks are locked for {draft.raceName}.
            </p>
            <Button onClick={() => router.push(`/leagues/${leagueId}`)} className="w-full">
              Back to League
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Modal */}
      {confirmModal && selectedDriver && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <Card className="w-full sm:max-w-md sm:mx-4 rounded-t-2xl sm:rounded-lg safe-bottom">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Confirm Pick</h3>
              <button
                onClick={() => {
                  setConfirmModal(false);
                  setSelectedDriver(null);
                }}
                className="p-1 rounded hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <CardContent className="p-4">
              <div className="bg-muted p-4 rounded-lg mb-4 text-center">
                <div className="font-mono font-bold text-3xl">{selectedDriver.code}</div>
                <div className="text-muted-foreground">{selectedDriver.name}</div>
                <div className="text-sm text-muted-foreground">{selectedDriver.team}</div>
                <div className="text-sm font-medium mt-1">{selectedDriver.seasonPoints} pts this season</div>
              </div>
              <p className="text-sm text-muted-foreground text-center mb-4">
                This pick cannot be changed.
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
                  {submitting ? 'Submitting...' : 'Confirm'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}