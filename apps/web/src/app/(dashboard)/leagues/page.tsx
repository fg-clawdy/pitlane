'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, ChevronRight, Trophy, Users } from 'lucide-react';

interface League {
  id: string;
  name: string;
  seasonId: string;
  scoringType: string;
  draftType: string;
  visibility: string;
  maxPlayers: number;
  memberCount?: number;
  isCommissioner?: boolean;
}

export default function LeaguesPage() {
  const router = useRouter();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [userLeagues, setUserLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem('accessToken') || sessionStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const fetchData = async () => {
      try {
        const [publicLeagues, myLeagues] = await Promise.all([
          api<League[]>('/leagues'),
          api<League[]>('/users/me/leagues', { token }),
        ]);
        setLeagues(publicLeagues);
        setUserLeagues(myLeagues);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load leagues');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  const userLeagueIds = new Set(userLeagues.map(l => l.id));
  const availableLeagues = leagues.filter(l => !userLeagueIds.has(l.id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leagues</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Browse and join leagues or create your own
          </p>
        </div>
        <Button 
          onClick={() => router.push('/leagues/create')} 
          size="default"
          className="h-10 px-4"
        >
          <Plus className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Create League</span>
          <span className="sm:hidden">Create</span>
        </Button>
      </div>

      {/* Your Leagues */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Your Leagues</h2>
        </div>
        
        {userLeagues.length === 0 ? (
          <Card className="bg-muted/50">
            <CardContent className="py-6 text-center">
              <p className="text-muted-foreground text-sm">
                You haven't joined any leagues yet
              </p>
              <Button 
                variant="link" 
                className="mt-2"
                onClick={() => router.push('/leagues/create')}
              >
                Create your first league
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {userLeagues.map((league) => (
              <Card 
                key={league.id} 
                className="cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => router.push(`/leagues/${league.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium truncate">{league.name}</h3>
                        {league.isCommissioner && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full whitespace-nowrap">
                            Commissioner
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {league.memberCount || 0}/{league.maxPlayers}
                        </span>
                        <span className="capitalize">{league.scoringType.replace('_', ' ')}</span>
                        <span className="capitalize hidden sm:inline">{league.draftType} draft</span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Public Leagues */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Public Leagues</h2>
        </div>
        
        {availableLeagues.length === 0 ? (
          <Card className="bg-muted/50">
            <CardContent className="py-6 text-center">
              <p className="text-muted-foreground text-sm">
                No public leagues available to join
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {availableLeagues.map((league) => (
              <Card 
                key={league.id} 
                className="cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => router.push(`/leagues/${league.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{league.name}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {league.memberCount || 0}/{league.maxPlayers}
                        </span>
                        <span className="capitalize">{league.scoringType.replace('_', ' ')}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}