'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';

const updateLeagueSchema = z.object({
  name: z.string()
    .min(3, 'League name must be at least 3 characters')
    .max(80, 'League name must be at most 80 characters'),
  visibility: z.enum(['public', 'private']),
  joinApprovalRequired: z.boolean(),
  targetPlayers: z.number().int().min(2).max(11),
  maxPlayers: z.number().int().min(2).max(11),
  missedPickResolution: z.enum(['random', 'top_points', 'no_pick']),
  substitutionPolicy: z.enum(['redraft', 'auto_replace', 'none']),
});

type UpdateLeagueFormData = z.infer<typeof updateLeagueSchema>;

interface League {
  id: string;
  name: string;
  seasonId: string;
  commissionerId: string;
  scoringType: 'fia_official' | 'linear_20' | 'proprietary';
  draftType: 'snake' | 'regular';
  visibility: 'public' | 'private';
  joinApprovalRequired: boolean;
  targetPlayers: number;
  maxPlayers: number;
  missedPickResolution: 'random' | 'top_points' | 'no_pick';
  substitutionPolicy: 'redraft' | 'auto_replace' | 'none';
  settingsLocked: boolean;
  createdAt: string;
}

const visibilityOptions = [
  { value: 'private', label: 'Private' },
  { value: 'public', label: 'Public' },
];

const missedPickOptions = [
  { value: 'random', label: 'Random Available Driver' },
  { value: 'top_points', label: 'Highest Points Available' },
  { value: 'no_pick', label: 'No Pick (0 Points)' },
];

const substitutionPolicyOptions = [
  { value: 'redraft', label: 'Allow Re-draft' },
  { value: 'auto_replace', label: 'Auto Replace' },
  { value: 'none', label: 'No Action' },
];

export default function LeagueSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params.id as string;
  
  const [token, setToken] = useState<string | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<UpdateLeagueFormData>({
    resolver: zodResolver(updateLeagueSchema),
  });

  const visibility = watch('visibility');

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
    
    const fetchLeague = async () => {
      try {
        setLoading(true);
        const data = await api<League>(`/leagues/${leagueId}`, { token });
        setLeague(data);
        reset({
          name: data.name,
          visibility: data.visibility,
          joinApprovalRequired: data.joinApprovalRequired,
          targetPlayers: data.targetPlayers,
          maxPlayers: data.maxPlayers,
          missedPickResolution: data.missedPickResolution,
          substitutionPolicy: data.substitutionPolicy,
        });
      } catch (err: any) {
        setError(err.message || 'Failed to load league');
      } finally {
        setLoading(false);
      }
    };
    
    fetchLeague();
  }, [token, leagueId, reset]);

  const onSubmit = async (data: UpdateLeagueFormData) => {
    if (!token) return;
    
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await api(`/leagues/${leagueId}`, {
        method: 'PATCH',
        body: data,
        token,
      });
      setSuccess('League settings updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update league');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-lg">Loading settings...</div>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">League Settings</h1>
          <p className="text-muted-foreground">{league?.name}</p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/leagues/${leagueId}`)}>
          Back to League
        </Button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <Button variant="default" size="sm">Settings</Button>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => router.push(`/leagues/${leagueId}/settings/members`)}
        >
          Members & Invites
        </Button>
      </div>

      {league?.settingsLocked && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-4">
            <p className="text-sm text-yellow-800">
              ⚠️ Some settings are locked because the first draft has already occurred. 
              Scoring type and draft type cannot be changed.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>
            Update your league configuration. Some settings may be locked after the season starts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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

            {/* League Name */}
            <div className="space-y-2">
              <Label htmlFor="name">League Name</Label>
              <Input
                id="name"
                placeholder="Enter league name"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            {/* Scoring Type - Read only if locked */}
            <div className="space-y-2">
              <Label htmlFor="scoringType">Scoring System</Label>
              <Input
                id="scoringType"
                value={
                  league?.scoringType === 'proprietary' ? 'Proprietary (10th = 10pts)' :
                  league?.scoringType === 'fia_official' ? 'FIA Official Points' :
                  'Linear 20-Point'
                }
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                {league?.settingsLocked 
                  ? 'Locked after first draft' 
                  : 'Cannot be changed after first draft'}
              </p>
            </div>

            {/* Draft Type - Read only if locked */}
            <div className="space-y-2">
              <Label htmlFor="draftType">Draft Type</Label>
              <Input
                id="draftType"
                value={league?.draftType === 'snake' ? 'Snake Draft' : 'Regular Draft'}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                {league?.settingsLocked 
                  ? 'Locked after first draft' 
                  : 'Cannot be changed after first draft'}
              </p>
            </div>

            {/* Visibility */}
            <div className="space-y-2">
              <Label htmlFor="visibility">Visibility</Label>
              <Select
                id="visibility"
                options={visibilityOptions}
                {...register('visibility')}
              />
              <p className="text-xs text-muted-foreground">
                Private: Invite only. Public: Anyone can find and join.
              </p>
            </div>

            {/* Join Approval (only for public) */}
            {visibility === 'public' && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="joinApprovalRequired"
                  className="h-4 w-4 rounded border-gray-300"
                  {...register('joinApprovalRequired')}
                />
                <Label htmlFor="joinApprovalRequired" className="font-normal">
                  Require approval for join requests
                </Label>
              </div>
            )}

            {/* Player Counts */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="targetPlayers">Target Players</Label>
                <Input
                  id="targetPlayers"
                  type="number"
                  min={2}
                  max={11}
                  {...register('targetPlayers', { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">Ideal league size</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxPlayers">Max Players</Label>
                <Input
                  id="maxPlayers"
                  type="number"
                  min={2}
                  max={11}
                  {...register('maxPlayers', { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">Maximum members (2-11)</p>
              </div>
            </div>

            {/* Missed Pick Resolution */}
            <div className="space-y-2">
              <Label htmlFor="missedPickResolution">Missed Pick Resolution</Label>
              <Select
                id="missedPickResolution"
                options={missedPickOptions}
                {...register('missedPickResolution')}
              />
              <p className="text-xs text-muted-foreground">
                What happens when a player doesn't submit their pick in time.
              </p>
            </div>

            {/* Substitution Policy */}
            <div className="space-y-2">
              <Label htmlFor="substitutionPolicy">Driver Substitution Policy</Label>
              <Select
                id="substitutionPolicy"
                options={substitutionPolicyOptions}
                {...register('substitutionPolicy')}
              />
              <p className="text-xs text-muted-foreground">
                How to handle F1 driver changes after draft lock.
              </p>
            </div>

            {/* Submit */}
            <div className="flex gap-3">
              <Button type="submit" disabled={saving || !isDirty}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button type="button" variant="outline" onClick={() => reset()}>
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions. Proceed with caution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Delete League</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete this league and all its data.
              </p>
            </div>
            <Button 
              variant="destructive"
              onClick={async () => {
                if (!token || !confirm('Are you sure you want to delete this league? This action cannot be undone.')) return;
                try {
                  await api(`/leagues/${leagueId}`, { method: 'DELETE', token });
                  router.push('/leagues');
                } catch (err: any) {
                  setError(err.message || 'Failed to delete league');
                }
              }}
            >
              Delete League
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}