'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getRace, getRaceResultsPublic, Race as RaceType, RaceResultPublic, ApiError } from '@/lib/api';
import { ChevronLeft, Flag, Trophy, Clock, Gauge, MapPin, Calendar, Timer } from 'lucide-react';

export default function RaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const seasonYear = parseInt(params.seasonId as string);
  const round = parseInt(params.round as string);
  
  const [token, setToken] = useState<string | null>(null);
  const [race, setRace] = useState<RaceType | null>(null);
  const [results, setResults] = useState<RaceResultPublic[]>([]);
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
        
        // Fetch race info using the season year from URL
        const raceData = await getRace(seasonYear, round);
        setRace(raceData);
        
        // Fetch results
        const resultsData = await getRaceResultsPublic(seasonYear, round);
        setResults(resultsData);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to load race details');
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [token, seasonYear, round]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getPositionStyle = (position: number) => {
    if (position === 1) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (position === 2) return 'bg-gray-100 text-gray-800 border-gray-300';
    if (position === 3) return 'bg-orange-100 text-orange-800 border-orange-300';
    if (position <= 10) return 'bg-green-50 text-green-800 border-green-200';
    return 'bg-muted text-muted-foreground';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-lg">Loading race details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-lg text-red-600">{error}</div>
        <Button onClick={() => router.push('/races')}>Back to Races</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.push('/races')}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{race?.raceName || `Round ${round}`}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>{race?.circuitName}</span>
          </div>
        </div>
      </div>

      {/* Race Info Card */}
      {race && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="text-sm font-medium">{formatDate(race.date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Round</p>
                  <p className="text-sm font-medium">{race.round}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Summary */}
      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <Trophy className="h-4 w-4 mx-auto text-yellow-500 mb-1" />
              <p className="text-sm font-bold">{results[0]?.driver?.code || '-'}</p>
              <p className="text-xs text-muted-foreground">Winner</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Trophy className="h-4 w-4 mx-auto text-gray-400 mb-1" />
              <p className="text-sm font-bold">{results[1]?.driver?.code || '-'}</p>
              <p className="text-xs text-muted-foreground">2nd</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Trophy className="h-4 w-4 mx-auto text-orange-500 mb-1" />
              <p className="text-sm font-bold">{results[2]?.driver?.code || '-'}</p>
              <p className="text-xs text-muted-foreground">3rd</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Full Results */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Flag className="h-4 w-4" />
            Race Results
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {results.length === 0 ? (
            <p className="text-muted-foreground text-center py-8 px-4 text-sm">
              No results available for this race yet.
            </p>
          ) : (
            <div className="divide-y">
              {results
                .sort((a, b) => a.position - b.position)
                .map((result) => (
                  <div 
                    key={result.id} 
                    className="flex items-center justify-between p-3 hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${getPositionStyle(result.position)}`}>
                        {result.position}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {result.driver.givenName} {result.driver.familyName}
                          </span>
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {result.driver.code}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>#{result.driver.permanentNumber || '-'}</span>
                          {result.fastestLap && (
                            <span className="text-purple-600 flex items-center gap-1">
                              <Timer className="h-3 w-3" /> FL
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{result.points}</p>
                      <p className="text-xs text-muted-foreground">pts</p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fastest Lap */}
      {results.some(r => r.fastestLap) && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Gauge className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Fastest Lap</p>
                <p className="text-xs text-muted-foreground">
                  {results.find(r => r.fastestLap)?.driver?.code} - {results.find(r => r.fastestLap)?.time || 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}