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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <a href="/" className="text-2xl font-bold text-foreground">
            PitLane
          </a>
        </div>
        {children}
      </div>
    </div>
  );
}