'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';

const createLeagueSchema = z.object({
  name: z.string()
    .min(3, 'League name must be at least 3 characters')
    .max(80, 'League name must be at most 80 characters'),
  scoringType: z.enum(['fia_official', 'linear_20', 'proprietary']).default('proprietary'),
  draftType: z.enum(['snake', 'regular']).default('snake'),
  visibility: z.enum(['public', 'private']).default('private'),
  joinApprovalRequired: z.boolean().default(false),
  targetPlayers: z.number().int().min(2).max(11).default(6),
  maxPlayers: z.number().int().min(2).max(11).default(10),
  missedPickResolution: z.enum(['random', 'top_points', 'no_pick']).default('random'),
  substitutionPolicy: z.enum(['redraft', 'auto_replace']).default('redraft'),
});

type CreateLeagueFormData = z.infer<typeof createLeagueSchema>;

const scoringTypeOptions = [
  { value: 'proprietary', label: 'Proprietary (10th = 10pts)' },
  { value: 'fia_official', label: 'FIA Official Points' },
  { value: 'linear_20', label: 'Linear 20-Point' },
];

const draftTypeOptions = [
  { value: 'snake', label: 'Snake Draft' },
  { value: 'regular', label: 'Regular Draft' },
];

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
];

export function CreateLeagueForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateLeagueFormData>({
    resolver: zodResolver(createLeagueSchema),
    defaultValues: {
      name: '',
      scoringType: 'proprietary',
      draftType: 'snake',
      visibility: 'private',
      joinApprovalRequired: false,
      targetPlayers: 6,
      maxPlayers: 10,
      missedPickResolution: 'random',
      substitutionPolicy: 'redraft',
    },
  });

  const visibility = watch('visibility');

  const onSubmit = async (data: CreateLeagueFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const token = sessionStorage.getItem('accessToken');
      if (!token) {
        router.push('/login');
        return;
      }

      // Get current season ID
      const currentYear = new Date().getFullYear();
      const seasonsResponse = await api<{ seasons: { id: string; year: number }[] }>(
        `/seasons?year=${currentYear}`,
        { token }
      );

      const season = seasonsResponse.seasons?.[0];
      if (!season) {
        setError('No active F1 season found. Please try again later.');
        setIsLoading(false);
        return;
      }

      const response = await api<{ league: { id: string } }>(
        '/leagues',
        {
          method: 'POST',
          body: {
            name: data.name,
            seasonId: season.id,
            scoringType: data.scoringType,
            draftType: data.draftType,
            visibility: data.visibility,
            joinApprovalRequired: data.joinApprovalRequired,
            targetPlayers: data.targetPlayers,
            maxPlayers: data.maxPlayers,
            missedPickResolution: data.missedPickResolution,
            substitutionPolicy: data.substitutionPolicy,
          },
          token,
        }
      );

      router.push(`/leagues/${response.league.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create league';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create a New League</CardTitle>
        <CardDescription>
          Set up your F1 fantasy league. You'll be the commissioner and can invite friends to join.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
              {error}
            </div>
          )}

          {/* League Name */}
          <div className="space-y-2">
            <Label htmlFor="name">League Name *</Label>
            <Input
              id="name"
              placeholder="Enter league name"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Scoring Type */}
          <div className="space-y-2">
            <Label htmlFor="scoringType">Scoring System *</Label>
            <Select
              id="scoringType"
              options={scoringTypeOptions}
              {...register('scoringType')}
            />
            <p className="text-xs text-muted-foreground">
              Proprietary: 10th place = 10pts max. FIA: Official points. Linear: 1st = 20pts.
            </p>
          </div>

          {/* Draft Type */}
          <div className="space-y-2">
            <Label htmlFor="draftType">Draft Type *</Label>
            <Select
              id="draftType"
              options={draftTypeOptions}
              {...register('draftType')}
            />
            <p className="text-xs text-muted-foreground">
              Snake: Order reverses each round. Regular: Same order each round.
            </p>
          </div>

          {/* Visibility */}
          <div className="space-y-2">
            <Label htmlFor="visibility">Visibility *</Label>
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
            <Label htmlFor="missedPickResolution">Missed Pick Resolution *</Label>
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
            <Label htmlFor="substitutionPolicy">Driver Substitution Policy *</Label>
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
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create League'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}