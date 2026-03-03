'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';

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

interface InviteLink {
  id: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  usedCount: number;
  maxUses: number | null;
  createdBy: {
    username: string;
  };
}

interface JoinRequest {
  id: string;
  userId: string;
  teamName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName: string | null;
  };
}

interface League {
  id: string;
  name: string;
  commissionerId: string;
  visibility: 'public' | 'private';
  joinApprovalRequired: boolean;
  maxPlayers: number;
}

export default function MembersManagementPage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params.id as string;
  
  const [token, setToken] = useState<string | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // New invite link state
  const [creatingLink, setCreatingLink] = useState(false);
  const [newLinkExpires, setNewLinkExpires] = useState('7');

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
        
        // Fetch league info
        const leagueData = await api<League>(`/leagues/${leagueId}`, { token });
        setLeague(leagueData);
        
        // Fetch members
        const membersData = await api<{ members: LeagueMember[] }>(
          `/leagues/${leagueId}/members`,
          { token }
        );
        setMembers(membersData.members);
        
        // Fetch invite links
        const linksData = await api<{ inviteLinks: InviteLink[] }>(
          `/leagues/${leagueId}/invite-links`,
          { token }
        );
        setInviteLinks(linksData.inviteLinks || []);
        
        // Fetch join requests if approval required
        if (leagueData.joinApprovalRequired || leagueData.visibility === 'public') {
          const requestsData = await api<{ requests: JoinRequest[] }>(
            `/leagues/${leagueId}/join-requests`,
            { token }
          );
          setJoinRequests(requestsData.requests || []);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [token, leagueId]);

  const createInviteLink = async () => {
    if (!token) return;
    
    setCreatingLink(true);
    setError(null);
    
    try {
      const response = await api<{ inviteLink: InviteLink }>(
        `/leagues/${leagueId}/invite-links`,
        {
          method: 'POST',
          body: {
            expiresInSeconds: parseInt(newLinkExpires) * 24 * 60 * 60,
          },
          token,
        }
      );
      setInviteLinks([...inviteLinks, response.inviteLink]);
      setSuccess('Invite link created!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to create invite link');
    } finally {
      setCreatingLink(false);
    }
  };

  const copyInviteLink = (tokenStr: string) => {
    const url = `${window.location.origin}/join/${tokenStr}`;
    navigator.clipboard.writeText(url);
    setSuccess('Invite link copied to clipboard!');
    setTimeout(() => setSuccess(null), 3000);
  };

  const removeMember = async (memberId: string, teamName: string) => {
    if (!token || !confirm(`Remove "${teamName}" from the league?`)) return;
    
    try {
      await api(`/leagues/${leagueId}/members/${memberId}`, {
        method: 'DELETE',
        token,
      });
      setMembers(members.filter(m => m.id !== memberId));
      setSuccess('Member removed successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to remove member');
    }
  };

  const resolveJoinRequest = async (requestId: string, approve: boolean) => {
    if (!token) return;
    
    try {
      await api(`/leagues/${leagueId}/join-requests/${requestId}`, {
        method: 'PATCH',
        body: { status: approve ? 'approved' : 'rejected' },
        token,
      });
      setJoinRequests(joinRequests.filter(r => r.id !== requestId));
      setSuccess(`Join request ${approve ? 'approved' : 'rejected'}`);
      setTimeout(() => setSuccess(null), 3000);
      
      // Refresh members if approved
      if (approve) {
        const membersData = await api<{ members: LeagueMember[] }>(
          `/leagues/${leagueId}/members`,
          { token }
        );
        setMembers(membersData.members);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resolve request');
    }
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const isExpired = (dateStr: string) => {
    return new Date(dateStr) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (error && !league) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-lg text-red-600">{error}</div>
        <Button onClick={() => router.push('/leagues')}>Back to Leagues</Button>
      </div>
    );
  }

  const pendingRequests = joinRequests.filter(r => r.status === 'pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Members & Invites</h1>
          <p className="text-muted-foreground">{league?.name}</p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/leagues/${leagueId}`)}>
          Back to League
        </Button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => router.push(`/leagues/${leagueId}/settings`)}
        >
          Settings
        </Button>
        <Button variant="default" size="sm">Members & Invites</Button>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 text-sm text-green-600 bg-green-50 rounded-md">
          {success}
        </div>
      )}

      {/* Join Requests */}
      {pendingRequests.length > 0 && (
        <Card className="border-yellow-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Pending Join Requests
              <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                {pendingRequests.length}
              </span>
            </CardTitle>
            <CardDescription>
              Review and approve or reject join requests for your league.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{request.teamName}</p>
                    <p className="text-sm text-muted-foreground">
                      {request.user.displayName || request.user.username} • {formatDateTime(request.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => resolveJoinRequest(request.id, true)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => resolveJoinRequest(request.id, false)}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Links */}
      <Card>
        <CardHeader>
          <CardTitle>Invite Links</CardTitle>
          <CardDescription>
            Create and share invite links to bring new members to your league.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create new link */}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label htmlFor="expires">Expires after (days)</Label>
              <Input
                id="expires"
                type="number"
                min={1}
                max={30}
                value={newLinkExpires}
                onChange={(e) => setNewLinkExpires(e.target.value)}
                className="w-32"
              />
            </div>
            <Button onClick={createInviteLink} disabled={creatingLink}>
              {creatingLink ? 'Creating...' : 'Create Invite Link'}
            </Button>
          </div>

          {/* Existing links */}
          {inviteLinks.length > 0 && (
            <div className="space-y-2 mt-4">
              <p className="text-sm font-medium">Active Links</p>
              {inviteLinks.map((link) => {
                const expired = isExpired(link.expiresAt);
                return (
                  <div key={link.id} className={`p-3 border rounded-lg ${expired ? 'opacity-50 bg-gray-50' : 'bg-muted/30'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {window.location.origin}/join/{link.token}
                        </code>
                        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                          <span>Created: {formatDateTime(link.createdAt)}</span>
                          <span className={expired ? 'text-red-600' : ''}>
                            {expired ? 'Expired' : `Expires: ${formatDateTime(link.expiresAt)}`}
                          </span>
                          <span>Uses: {link.usedCount}{link.maxUses ? `/${link.maxUses}` : ''}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyInviteLink(link.token)}
                        disabled={expired}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Members
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({members.length}/{league?.maxPlayers || 11})
            </span>
          </CardTitle>
          <CardDescription>
            Manage league members. As commissioner, you can remove members (except yourself).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium">
                      {member.teamName}
                      {member.isCommissioner && (
                        <span className="ml-2 bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded">
                          Commissioner
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {member.user.displayName || member.user.username}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm text-muted-foreground">
                    Joined {formatDateTime(member.joinedAt)}
                  </p>
                  {!member.isCommissioner && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => removeMember(member.id, member.teamName)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}