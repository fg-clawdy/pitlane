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
  memberCount?: number;
  isCommissioner?: boolean;
}

export default function DashboardPage() {
  const router = useRouter();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem('accessToken');
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Manage your leagues and draft picks.
          </p>
        </div>
        <Button onClick={() => router.push('/leagues/create')}>
          Create League
        </Button>
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-4">Your Leagues</h2>
        {leagues.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-4">
                You haven't joined any leagues yet.
              </p>
              <div className="flex gap-4 justify-center">
                <Button variant="outline" onClick={() => router.push('/leagues')}>
                  Browse Leagues
                </Button>
                <Button onClick={() => router.push('/leagues/create')}>
                  Create League
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {leagues.map((league) => (
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
                    {league.memberCount || 0}/{league.memberCount || 0} players
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="capitalize">{league.scoringType.replace('_', ' ')}</span>
                    <span>•</span>
                    <span className="capitalize">{league.draftType} draft</span>
                    <span>•</span>
                    <span className="capitalize">{league.visibility}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => router.push('/leagues')}>
            <CardHeader>
              <CardTitle className="text-lg">Browse Leagues</CardTitle>
              <CardDescription>Find public leagues to join</CardDescription>
            </CardHeader>
          </Card>
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => router.push('/leagues/create')}>
            <CardHeader>
              <CardTitle className="text-lg">Create League</CardTitle>
              <CardDescription>Start a new league with friends</CardDescription>
            </CardHeader>
          </Card>
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => router.push('/settings/profile')}>
            <CardHeader>
              <CardTitle className="text-lg">Profile Settings</CardTitle>
              <CardDescription>Update your profile and preferences</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>
    </div>
  );
}