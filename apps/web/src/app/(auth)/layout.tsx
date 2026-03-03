import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PitLane - Authentication',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background header-safe">
      {/* Simple Header */}
      <header className="px-4 py-6">
        <div className="text-center">
          <a href="/" className="text-2xl font-bold text-foreground inline-block">
            PitLane
          </a>
          <p className="text-sm text-muted-foreground mt-1">
            Fantasy Formula 1
          </p>
        </div>
      </header>

      {/* Auth Content */}
      <main className="flex-1 flex items-start justify-center px-4 pt-4 pb-8 safe-bottom">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>
    </div>
  );
}