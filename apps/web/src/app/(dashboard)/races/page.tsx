'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSeasons, getRacesBySeason, Season, Race, ApiError } from '@/lib/api';
import { Calendar, Flag, ChevronRight, Trophy, Clock } from 'lucide-react';

export default function RacesPage() {
  const router = useRouter();
  
  const [token, setToken] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [races, setRaces] = useState<Race[]>([]);
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
    
    const fetchSeasons = async () => {
      try {
        setLoading(true);
        const data = await getSeasons();
        setSeasons(data);
        // Select the most recent season by default
        if (data.length > 0) {
          const latestYear = Math.max(...data.map(s => s.year));
          setSelectedSeason(latestYear);
        }
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to load seasons');
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchSeasons();
  }, [token]);

  useEffect(() => {
    if (!selectedSeason) return;
    
    const fetchRaces = async () => {
      try {
        const data = await getRacesBySeason(selectedSeason);
        setRaces(data);
      } catch (err) {
        console.error('Failed to load races:', err);
      }
    };
    
    fetchRaces();
  }, [selectedSeason]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric'
    });
  };

  const getRaceStatus = (dateStr: string) => {
    const raceDate = new Date(dateStr);
    const now = new Date();
    if (raceDate < now) {
      return 'completed';
    } else if (raceDate.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return 'upcoming';
    }
    return 'scheduled';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-lg">Loading races...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-lg text-red-600">{error}</div>
        <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Race Calendar
          </h1>
          <p className="text-sm text-muted-foreground">
            View race schedule and results
          </p>
        </div>
      </div>

      {/* Season Selector */}
      {seasons.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {seasons
            .sort((a, b) => b.year - a.year)
            .map((season) => (
              <button
                key={season.id}
                onClick={() => setSelectedSeason(season.year)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedSeason === season.year
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {season.year}
              </button>
            ))}
        </div>
      )}

      {/* Races List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {selectedSeason} Season
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {races.length === 0 ? (
            <p className="text-muted-foreground text-center py-8 px-4 text-sm">
              No races found for this season.
            </p>
          ) : (
            <div className="divide-y">
              {races
                .sort((a, b) => a.round - b.round)
                .map((race) => {
                  const status = getRaceStatus(race.date);
                  return (
                    <div
                      key={race.id}
                      className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer"
                      onClick={() => router.push(`/races/${selectedSeason}/${race.round}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                          status === 'completed' ? 'bg-green-100 text-green-800' :
                          status === 'upcoming' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {race.round}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{race.raceName}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Flag className="h-3 w-3" />
                            <span>{race.circuitName}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-medium">{formatDate(race.date)}</p>
                          <p className="text-xs text-muted-foreground">
                            {status === 'completed' ? 'Completed' : 
                             status === 'upcoming' ? 'Upcoming' : 'Scheduled'}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}