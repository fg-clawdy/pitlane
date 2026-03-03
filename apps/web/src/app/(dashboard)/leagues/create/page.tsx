'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CreateLeagueForm } from '@/components/leagues/create-league-form';

export default function CreateLeaguePage() {
  const router = useRouter();

  useEffect(() => {
    const token = sessionStorage.getItem('accessToken');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="container py-8">
      <CreateLeagueForm />
    </div>
  );
}