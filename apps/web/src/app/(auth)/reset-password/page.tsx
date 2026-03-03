import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import Link from 'next/link';

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token } = await searchParams;

  return (
    <div>
      <ResetPasswordForm token={token || ''} />
      <p className="text-center mt-4 text-sm text-muted-foreground">
        Remember your password?{' '}
        <Link href="/login" className="text-primary hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}