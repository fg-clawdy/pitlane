'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
    const token = sessionStorage.getItem('accessToken');
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leagues</h1>
          <p className="text-muted-foreground mt-1">
            Browse and join public leagues or create your own.
          </p>
        </div>
        <Button onClick={() => router.push('/leagues/create')}>
          Create League
        </Button>
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-4">Your Leagues</h2>
        {userLeagues.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                You haven't joined any leagues yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {userLeagues.map((league) => (
              <Card 
                key={league.id} 
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => router.push(`/leagues/${league.id}`)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {league.name}
                    {league.isCommissioner && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                        Commissioner
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {league.memberCount || 0}/{league.maxPlayers} players
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="capitalize">{league.scoringType.replace('_', ' ')}</span>
                    <span>•</span>
                    <span className="capitalize">{league.draftType} draft</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Public Leagues</h2>
        {availableLeagues.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                No public leagues available to join.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {availableLeagues.map((league) => (
              <Card 
                key={league.id} 
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => router.push(`/leagues/${league.id}`)}
              >
                <CardHeader>
                  <CardTitle>{league.name}</CardTitle>
                  <CardDescription>
                    {league.memberCount || 0}/{league.maxPlayers} players
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="capitalize">{league.scoringType.replace('_', ' ')}</span>
                    <span>•</span>
                    <span className="capitalize">{league.draftType} draft</span>
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