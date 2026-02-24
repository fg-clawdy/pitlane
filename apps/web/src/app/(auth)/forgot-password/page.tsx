import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  return (
    <div>
      <ForgotPasswordForm />
      <p className="text-center mt-4 text-sm text-muted-foreground">
        Remember your password?{' '}
        <Link href="/login" className="text-primary hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}