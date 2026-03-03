'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setStatus('error');
      setError('No verification token provided');
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await api(`/auth/verify-email?token=${token}`, {
          method: 'GET',
        }) as { message: string; accessToken: string; user: { id: string; email: string; username: string } };
        
        // Store the access token
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', response.accessToken);
          localStorage.setItem('user', JSON.stringify(response.user));
        }
        
        setStatus('success');
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Verification failed');
      }
    };

    verifyEmail();
  }, [searchParams, router]);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="pt-6">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <h2 className="text-xl font-semibold mb-2">Verifying your email...</h2>
              <p className="text-muted-foreground">Please wait while we verify your account.</p>
            </>
          )}
          {status === 'success' && (
            <>
              <h2 className="text-xl font-semibold mb-2 text-green-600">Email Verified!</h2>
              <p className="text-muted-foreground">Your account has been verified. Redirecting to dashboard...</p>
            </>
          )}
          {status === 'error' && (
            <>
              <h2 className="text-xl font-semibold mb-2 text-destructive">Verification Failed</h2>
              <p className="text-muted-foreground">{error}</p>
              <a href="/signup" className="text-primary hover:underline mt-4 inline-block">
                Try registering again
              </a>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Loading...</h2>
          </div>
        </CardContent>
      </Card>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}