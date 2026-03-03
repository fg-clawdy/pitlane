'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Plus, Search, Settings, ChevronRight } from 'lucide-react';

interface League {
  id: string;
  name: string;
  seasonId: string;
  scoringType: string;
  draftType: string;
  visibility: string;
  memberCount?: number;
  isCommissioner?: boolean;
}

export default function DashboardPage() {
  const router = useRouter();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem('accessToken') || sessionStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const fetchLeagues = async () => {
      try {
        const data = await api<League[]>('/users/me/leagues', { token });
        setLeagues(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load leagues');
      } finally {
        setLoading(false);
      }
    };

    fetchLeagues();
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

  return (
    <div className="space-y-6">
      {/* Header with CTA */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your leagues and draft picks
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

      {/* Your Leagues Section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Your Leagues</h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push('/leagues')}
            className="text-primary"
          >
            View all
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
        
        {leagues.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Trophy className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">
                You haven't joined any leagues yet
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="outline" onClick={() => router.push('/leagues')}>
                  <Search className="h-4 w-4 mr-2" />
                  Browse Leagues
                </Button>
                <Button onClick={() => router.push('/leagues/create')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create League
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {leagues.slice(0, 3).map((league) => (
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
                      <p className="text-sm text-muted-foreground mt-1">
                        {league.memberCount || 0} players • {league.scoringType.replace('_', ' ')}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
            {leagues.length > 3 && (
              <Button 
                variant="ghost" 
                className="w-full"
                onClick={() => router.push('/leagues')}
              >
                View all {leagues.length} leagues
              </Button>
            )}
          </div>
        )}
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <Card 
            className="cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => router.push('/leagues')}
          >
            <CardContent className="p-4 text-center">
              <Search className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="font-medium text-sm">Browse</p>
              <p className="text-xs text-muted-foreground mt-0.5">Find leagues</p>
            </CardContent>
          </Card>
          <Card 
            className="cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => router.push('/leagues/create')}
          >
            <CardContent className="p-4 text-center">
              <Plus className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="font-medium text-sm">Create</p>
              <p className="text-xs text-muted-foreground mt-0.5">New league</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <h3 className="font-medium mb-1">How it works</h3>
          <p className="text-sm text-muted-foreground">
            Join or create a league, draft constructors for each race, and compete for points based on real F1 results.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}