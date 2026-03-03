'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSeasons, getDriversBySeason, getTeamsBySeason, Season, Driver, Team, ApiError } from '@/lib/api';
import { Users, Flag, ChevronRight, Car } from 'lucide-react';

export default function DriversPage() {
  const router = useRouter();
  
  const [token, setToken] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
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
    
    const fetchData = async () => {
      try {
        const [driversData, teamsData] = await Promise.all([
          getDriversBySeason(selectedSeason),
          getTeamsBySeason(selectedSeason)
        ]);
        setDrivers(driversData);
        setTeams(teamsData);
      } catch (err) {
        console.error('Failed to load data:', err);
      }
    };
    
    fetchData();
  }, [selectedSeason]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-lg">Loading drivers...</div>
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

  // Create a map of team IDs to teams
  const teamMap = new Map<string, Team>();
  teams.forEach(team => teamMap.set(team.id, team));

  // Group drivers by team
  const driversByTeam = new Map<string | null, Driver[]>();
  drivers.forEach(driver => {
    const teamId = driver.teamId || null;
    if (!driversByTeam.has(teamId)) {
      driversByTeam.set(teamId, []);
    }
    driversByTeam.get(teamId)!.push(driver);
  });

  // Sort drivers within each team by permanent number
  driversByTeam.forEach((teamDrivers) => {
    teamDrivers.sort((a, b) => {
      const numA = a.permanentNumber || 999;
      const numB = b.permanentNumber || 999;
      return numA - numB;
    });
  });

  // Get teams with drivers, sorted by team name
  const teamsWithDrivers = Array.from(driversByTeam.entries())
    .filter(([teamId]) => teamId !== null)
    .map(([teamId, teamDrivers]) => ({
      team: teamMap.get(teamId!),
      drivers: teamDrivers
    }))
    .filter(({ team }) => team)
    .sort((a, b) => a.team!.name.localeCompare(b.team!.name));

  // Get drivers without teams (fallback)
  const driversWithoutTeam = driversByTeam.get(null) || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Driver Lineup
          </h1>
          <p className="text-sm text-muted-foreground">
            View all drivers for the season
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

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <Users className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold">{drivers.length}</p>
            <p className="text-xs text-muted-foreground">Drivers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Car className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold">{teams.length}</p>
            <p className="text-xs text-muted-foreground">Teams</p>
          </CardContent>
        </Card>
      </div>

      {/* Teams with Drivers */}
      {teamsWithDrivers.map(({ team, drivers: teamDrivers }) => (
        <Card key={team!.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Car className="h-4 w-4" />
              {team!.name}
              <span className="text-xs text-muted-foreground font-normal">
                ({team!.fullName})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {teamDrivers.map((driver) => (
                <div 
                  key={driver.id} 
                  className="flex items-center justify-between p-3 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                      <span className="text-lg font-bold">
                        #{driver.permanentNumber || '-'}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {driver.givenName} {driver.familyName}
                        </span>
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {driver.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Flag className="h-3 w-3" />
                        <span>{driver.nationality}</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Drivers without teams (fallback) */}
      {driversWithoutTeam.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Other Drivers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {driversWithoutTeam.map((driver) => (
                <div 
                  key={driver.id} 
                  className="flex items-center justify-between p-3 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                      <span className="text-lg font-bold">
                        #{driver.permanentNumber || '-'}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {driver.givenName} {driver.familyName}
                        </span>
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {driver.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Flag className="h-3 w-3" />
                        <span>{driver.nationality}</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {drivers.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <p className="text-muted-foreground text-center text-sm">
              No drivers found for this season.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}