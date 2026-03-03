'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../ui/card';
import { getEmailPrefix } from '../../lib/utils';
import { api } from '../../lib/api';

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(30),
});

type SignupFormData = z.infer<typeof signupSchema>;

export function SignupForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: '',
    },
  });

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api('/auth/register', {
        method: 'POST',
        body: data,
      }) as { message: string; userId: string };
      
      // Extract verification token from development mode response
      const tokenMatch = response.message.match(/Verification token: ([a-f0-9]+)/);
      if (tokenMatch) {
        setVerificationToken(tokenMatch[1]);
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    // In development mode, show the verification link directly
    if (verificationToken) {
      return (
        <Card className="w-full border-0 shadow-lg md:border md:shadow-sm">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <span className="text-2xl">✓</span>
              </div>
              <h2 className="text-xl font-semibold">Account Created!</h2>
              <p className="text-muted-foreground text-sm">
                Email verification is not configured. Use the link below to verify your account:
              </p>
              <div className="p-4 bg-muted rounded-lg">
                <a 
                  href={`/verify-email?token=${verificationToken}`}
                  className="text-primary font-medium hover:underline break-all"
                >
                  Click here to verify your email
                </a>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Or copy this token: <code className="bg-muted px-2 py-1 rounded text-xs break-all">{verificationToken}</code>
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }
    
    return (
      <Card className="w-full border-0 shadow-lg md:border md:shadow-sm">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl">✓</span>
            </div>
            <h2 className="text-xl font-semibold">Check your email</h2>
            <p className="text-muted-foreground">
              We've sent a verification link to your email address.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full border-0 shadow-lg md:border md:shadow-sm">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-xl">Create Account</CardTitle>
        <CardDescription>Join PitLane and start racing</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              className="h-12 text-base"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm font-medium">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder={getEmailPrefix('user@example.com')}
              autoCapitalize="none"
              autoCorrect="off"
              className="h-12 text-base"
              {...register('username')}
            />
            {errors.username && (
              <p className="text-sm text-destructive">{errors.username.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              className="h-12 text-base"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              8+ chars with uppercase, lowercase, number & special char
            </p>
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 text-base font-medium" 
            disabled={isLoading}
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </Button>

          <div className="text-center pt-4">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <a href="/login" className="text-primary font-medium hover:underline">
                Sign in
              </a>
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}