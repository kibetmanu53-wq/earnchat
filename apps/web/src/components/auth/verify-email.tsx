'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type Status = 'verifying' | 'verified' | 'error' | 'ready' | 'sending' | 'sent';

export function VerifyEmail({ token }: { token: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'ready');
  const [message, setMessage] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    (async () => {
      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          setStatus('error');
          setMessage(data.error ?? 'This verification link is invalid or has expired.');
          return;
        }
        setStatus('verified');
        setTimeout(() => {
          router.push('/activate');
          router.refresh();
        }, 1200);
      } catch {
        setStatus('error');
        setMessage('Could not reach the server. Please try again.');
      }
    })();
  }, [token, router]);

  async function resend() {
    setStatus('sending');
    setMessage(null);
    try {
      const response = await fetch('/api/auth/resend-verification', { method: 'POST' });
      const data = (await response.json().catch(() => ({}))) as { error?: string; email?: string };
      if (response.status === 401) {
        setStatus('ready');
        setMessage('Please sign in again to resend the verification email.');
        return;
      }
      if (!response.ok) {
        setStatus('ready');
        setMessage(data.error ?? 'Could not send the email. Please try again.');
        return;
      }
      setStatus('sent');
      setMessage(`If ${data.email ?? 'your email'} is not yet verified, a new link is on its way.`);
    } catch {
      setStatus('ready');
      setMessage('Could not reach the server. Please try again.');
    }
  }

  return (
    <Card>
      <CardContent className="p-7">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">
          {status === 'verified' ? 'Email verified' : 'Verify your email'}
        </h1>

        {status === 'verifying' ? <p className="mt-2 text-sm text-muted-foreground">Verifying your link…</p> : null}

        {status === 'verified' ? (
          <p className="mt-2 text-sm text-muted-foreground">Thanks! Redirecting you to activate your account…</p>
        ) : null}

        {status === 'ready' || status === 'sending' || status === 'sent' ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a verification link to your email address. Click it to continue setting up your account, then pay
              the one-time activation fee.
            </p>
            <div className="mt-5 space-y-3">
              <Button onClick={resend} disabled={status === 'sending'} className="w-full">
                {status === 'sending' ? 'Sending…' : 'Resend verification email'}
              </Button>
              {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
              <p className="text-center text-sm text-muted-foreground">
                Already verified?{' '}
                <Link href="/activate" className="font-semibold text-primary hover:underline">
                  Continue
                </Link>
              </p>
            </div>
          </>
        ) : null}

        {status === 'error' ? (
          <>
            <p className="mt-2 text-sm text-destructive">{message}</p>
            <div className="mt-5 space-y-3">
              <Button onClick={resend} className="w-full">
                Send a new link
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <Link href="/sign-in" className="font-semibold text-primary hover:underline">
                  Back to sign in
                </Link>
              </p>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
