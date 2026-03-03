import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronRight, Trophy, Users, Zap, Calendar } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Header */}
      <header className="container mx-auto px-4 py-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-primary">PitLane</span>
        </div>
        <nav className="flex gap-4 items-center">
          <Link href="/login">
            <Button variant="ghost">Log In</Button>
          </Link>
          <Link href="/signup">
            <Button>Sign Up</Button>
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
            Fantasy Formula 1
            <span className="block text-primary">Like Never Before</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Draft two drivers each race. Score points based on real results. Compete with friends for weekly wins and the season podium.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="gap-2">
                Get Started <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/leagues">
              <Button variant="outline" size="lg">
                Browse Leagues
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-20">
          <FeatureCard
            icon={<Zap className="w-8 h-8 text-primary" />}
            title="Per-Race Drafts"
            description="New draft every Grand Prix. Snake or regular format with 24-hour turn timers."
          />
          <FeatureCard
            icon={<Trophy className="w-8 h-8 text-primary" />}
            title="Multiple Scoring Systems"
            description="FIA official, linear 20-point, or our proprietary 10th=10pts system."
          />
          <FeatureCard
            icon={<Users className="w-8 h-8 text-primary" />}
            title="Private Leagues"
            description="Create leagues for friends or join public ones. Up to 11 players per league."
          />
          <FeatureCard
            icon={<Calendar className="w-8 h-8 text-primary" />}
            title="Live Data Sync"
            description="Automatic F1 data import via Jolpica API. Real-time race results and standings."
          />
        </div>

        {/* How It Works */}
        <div className="mt-24 text-center">
          <h2 className="text-3xl font-bold mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <StepCard
              number={1}
              title="Create or Join a League"
              description="Start your own league with friends or join an existing public league."
            />
            <StepCard
              number={2}
              title="Draft Your Drivers"
              description="Each race week, draft two drivers from the F1 grid in a snake or regular draft."
            />
            <StepCard
              number={3}
              title="Score & Compete"
              description="Earn points based on your drivers' real race results. Win weekly and season prizes!"
            />
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-24 text-center bg-primary/5 rounded-2xl p-12">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Your Season?</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join thousands of F1 fans competing in the most engaging fantasy motorsport platform.
          </p>
          <Link href="/signup">
            <Button size="lg" className="gap-2">
              Create Free Account <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t mt-20">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-muted-foreground">
            © 2026 PitLane. All rights reserved.
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/contact" className="hover:text-foreground">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-card rounded-lg p-6 border shadow-sm">
      <div className="mb-4">{icon}</div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function StepCard({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="text-left">
      <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold mb-4">
        {number}
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}