'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getLeagueDriverStandings, LeagueDriverStanding, ApiError } from '@/lib/api';
import { ChevronLeft, Users, Trophy, Flag, Gauge, Medal, Timer } from 'lucide-react';

export default function LeagueDriversPage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params.id as string;
  
  const [token, setToken] = useState<string | null>(null);
  const [driverStandings, setDriverStandings] = useState<LeagueDriverStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<LeagueDriverStanding | null>(null);

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
        const data = await getLeagueDriverStandings(leagueId);
        setDriverStandings(data.driverStandings);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to load driver standings');
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [token, leagueId]);

  const getPositionStyle = (position: number) => {
    if (position === 1) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (position === 2) return 'bg-gray-100 text-gray-800 border-gray-300';
    if (position === 3) return 'bg-orange-100 text-orange-800 border-orange-300';
    return 'bg-muted text-muted-foreground';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-lg">Loading driver standings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-lg text-red-600">{error}</div>
        <Button onClick={() => router.push(`/leagues/${leagueId}`)}>Back to League</Button>
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
          onClick={() => router.push(`/leagues/${leagueId}`)}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Driver Standings
          </h1>
          <p className="text-sm text-muted-foreground">
            Performance of all drivers in your league's races
          </p>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <Users className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold">{driverStandings.length}</p>
            <p className="text-xs text-muted-foreground">Drivers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Trophy className="h-4 w-4 mx-auto text-yellow-500 mb-1" />
            <p className="text-lg font-bold">
              {driverStandings.reduce((sum, d) => sum + d.wins, 0)}
            </p>
            <p className="text-xs text-muted-foreground">Total Wins</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Medal className="h-4 w-4 mx-auto text-orange-500 mb-1" />
            <p className="text-lg font-bold">
              {driverStandings.reduce((sum, d) => sum + d.podiums, 0)}
            </p>
            <p className="text-xs text-muted-foreground">Total Podiums</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Gauge className="h-4 w-4 mx-auto text-purple-500 mb-1" />
            <p className="text-lg font-bold">
              {driverStandings.reduce((sum, d) => sum + d.fastestLaps, 0)}
            </p>
            <p className="text-xs text-muted-foreground">Fastest Laps</p>
          </CardContent>
        </Card>
      </div>

      {/* Driver Standings List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Championship Standings</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {driverStandings.length === 0 ? (
            <p className="text-muted-foreground text-center py-8 px-4 text-sm">
              No driver data available. Complete races to see driver standings.
            </p>
          ) : (
            <div className="divide-y">
              {driverStandings.map((driver) => (
                <div 
                  key={driver.driverId} 
                  className="p-3 hover:bg-muted/50 cursor-pointer"
                  onClick={() => setSelectedDriver(selectedDriver?.driverId === driver.driverId ? null : driver)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${getPositionStyle(driver.position)}`}>
                        {driver.position}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{driver.driverName}</span>
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {driver.driverCode}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>#{driver.driverNumber}</span>
                          <span>•</span>
                          <span>{driver.nationality}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{driver.totalPoints}</p>
                      <p className="text-xs text-muted-foreground">points</p>
                    </div>
                  </div>
                  
                  {/* Driver Stats Row */}
                  <div className="flex items-center gap-4 mt-2 ml-11 text-xs">
                    {driver.wins > 0 && (
                      <span className="text-yellow-600 flex items-center gap-1">
                        <Trophy className="h-3 w-3" /> {driver.wins}
                      </span>
                    )}
                    {driver.podiums > 0 && (
                      <span className="text-orange-600 flex items-center gap-1">
                        <Medal className="h-3 w-3" /> {driver.podiums}
                      </span>
                    )}
                    {driver.fastestLaps > 0 && (
                      <span className="text-purple-600 flex items-center gap-1">
                        <Timer className="h-3 w-3" /> {driver.fastestLaps}
                      </span>
                    )}
                    {driver.dnfs > 0 && (
                      <span className="text-red-600 flex items-center gap-1">
                        <Flag className="h-3 w-3" /> {driver.dnfs} DNF
                      </span>
                    )}
                    <span className="text-muted-foreground">
                      {driver.racesStarted} races
                    </span>
                  </div>

                  {/* Expanded Race Results */}
                  {selectedDriver?.driverId === driver.driverId && driver.raceResults.length > 0 && (
                    <div className="mt-3 ml-11 border-t pt-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Race Results</p>
                      <div className="grid gap-2">
                        {driver.raceResults
                          .sort((a, b) => a.round - b.round)
                          .map((result) => (
                            <div 
                              key={result.raceId}
                              className="flex items-center justify-between text-sm bg-muted/30 rounded px-2 py-1"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">R{result.round}</span>
                                <span className="text-xs truncate max-w-[120px]">{result.raceName}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {result.fastestLap && (
                                  <span className="text-purple-600 text-xs">FL</span>
                                )}
                                <span className={`font-medium ${
                                  result.position <= 3 ? 'text-green-600' : 
                                  result.status === 'DNF' ? 'text-red-600' : ''
                                }`}>
                                  {result.status === 'DNF' ? 'DNF' : `P${result.position}`}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {result.points}pts
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}