'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Menu, X, Home, Trophy, Bell, Settings, LogOut, User, Calendar, Users } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [token, setToken] = useState<string>('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const hasCheckedAuth = useRef(false);
  
  useEffect(() => {
    // Only check auth once on mount
    if (hasCheckedAuth.current) return;
    hasCheckedAuth.current = true;
    
    // Get token on client-side (check both storage keys)
    const accessToken = sessionStorage.getItem('accessToken') || sessionStorage.getItem('token') || '';
    setToken(accessToken);
    
    // Redirect to login if no token
    if (!accessToken) {
      router.push('/login');
    } else {
      setIsCheckingAuth(false);
    }
  }, [router]);
  
  const handleLogout = () => {
    // Clear all token variants
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('token');
    router.push('/login');
  };

  const navItems = [
    { href: '/dashboard', label: 'Home', icon: Home },
    { href: '/leagues', label: 'Leagues', icon: Trophy },
    { href: '/races', label: 'Races', icon: Calendar },
    { href: '/drivers', label: 'Drivers', icon: Users },
    { href: '/notifications', label: 'Alerts', icon: Bell },
    { href: '/settings/profile', label: 'Profile', icon: User },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/dashboard/';
    }
    return pathname.startsWith(href);
  };

  // Close menu when route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Compact Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 header-safe">
        <div className="flex h-14 items-center justify-between px-4">
          {/* Logo */}
          <a href="/dashboard" className="text-xl font-bold text-primary">
            PitLane
          </a>

          {/* Desktop Nav - Hidden on Mobile */}
          <nav className="hidden md:flex items-center gap-6">
            <a 
              href="/dashboard" 
              className={`text-sm font-medium transition-colors ${
                isActive('/dashboard') ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Dashboard
            </a>
            <a 
              href="/leagues" 
              className={`text-sm font-medium transition-colors ${
                isActive('/leagues') ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Leagues
            </a>
            {token && !isCheckingAuth && <NotificationBell token={token} />}
            <a 
              href="/settings/profile" 
              className={`text-sm font-medium transition-colors ${
                isActive('/settings') ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Settings
            </a>
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Logout
            </button>
          </nav>

          {/* Mobile Header Actions */}
          <div className="flex md:hidden items-center gap-2">
            {token && !isCheckingAuth && <NotificationBell token={token} />}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-lg hover:bg-muted transition-colors touch-target"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Slide-out Menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          
          {/* Menu Panel */}
          <div className="absolute top-14 right-0 bottom-0 w-[280px] max-w-[85vw] bg-background border-l shadow-xl">
            <nav className="flex flex-col p-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors touch-target ${
                      isActive(item.href) 
                        ? 'bg-primary/10 text-primary font-medium' 
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </a>
                );
              })}
              
              <div className="border-t my-4" />
              
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted text-foreground transition-colors touch-target w-full text-left"
              >
                <LogOut className="h-5 w-5" />
                <span>Logout</span>
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 px-4 py-4 pb-20 md:pb-8">
        <div className="max-w-7xl mx-auto">
          {isCheckingAuth ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-lg">Loading...</div>
            </div>
          ) : (
            children
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background md:hidden bottom-nav-safe">
        <div className="flex items-center justify-around h-16">
          {navItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors touch-target ${
                  active 
                    ? 'text-primary' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? 'stroke-[2.5px]' : ''}`} />
                <span className={`text-xs mt-1 ${active ? 'font-medium' : ''}`}>
                  {item.label}
                </span>
              </a>
            );
          })}
        </div>
      </nav>
    </div>
  );
}