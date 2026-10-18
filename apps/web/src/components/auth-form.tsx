'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter();
  const isSignup = mode === 'sign-up';
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const body: Record<string, string> = {
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? '')
    };
    if (isSignup) body.displayName = String(form.get('displayName') ?? '');

    try {
      const response = await fetch(isSignup ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }
      router.push('/inbox');
      router.refresh();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-7">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">
          {isSignup ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isSignup ? 'Start earning from good conversations.' : 'Sign in to your EarnChat dashboard.'}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {isSignup ? (
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" name="displayName" autoComplete="name" minLength={2} maxLength={80} required />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={isSignup ? 'At least 10 characters' : 'Your password'}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                minLength={isSignup ? 10 : undefined}
                className="pr-11"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {!isSignup ? (
              <div className="text-right">
                <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
            ) : null}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {isSignup ? 'Already registered? ' : 'New here? '}
          <Link href={isSignup ? '/sign-in' : '/sign-up'} className="font-semibold text-primary hover:underline">
            {isSignup ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
