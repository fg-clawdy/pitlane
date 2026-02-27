'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { NotificationBell } from '@/components/notifications/notification-bell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [token, setToken] = useState<string>('');
  
  useEffect(() => {
    // Get token on client-side
    const accessToken = sessionStorage.getItem('accessToken') || '';
    setToken(accessToken);
    
    // Redirect to login if no token
    if (!accessToken) {
      router.push('/login');
    }
  }, [router]);
  
  // For SSR, we check for token on client-side in the page components
  // This layout provides the structure for authenticated pages
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <a href="/dashboard" className="text-xl font-bold text-primary">
            PitLane
          </a>
          <nav className="flex items-center gap-6">
            <a href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Dashboard
            </a>
            <a href="/leagues" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Leagues
            </a>
            {token && <NotificationBell token={token} />}
            <a href="/settings/profile" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Settings
            </a>
            <button
              onClick={() => {
                sessionStorage.removeItem('accessToken');
                router.push('/login');
              }}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Logout
            </button>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}