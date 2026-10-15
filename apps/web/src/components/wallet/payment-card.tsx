'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatKes } from '@/lib/utils';

type Status = 'idle' | 'sending' | 'pending' | 'paid' | 'failed';

export function PaymentCard({
  type,
  amountKes,
  title,
  description,
  ctaLabel
}: {
  type: 'verification' | 'beginner_membership';
  amountKes: number;
  title: string;
  description: string;
  ctaLabel: string;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
  }, []);

  function stopPolling() {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }

  function poll(paymentId: string) {
    stopPolling();
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/payments/${paymentId}`);
        if (!response.ok) {
          pollTimer.current = setTimeout(checkStatus, 2000);
          return;
        }
        const data = (await response.json()) as { payment?: { status?: string } };
        const next = data.payment?.status;
        if (next === 'paid') {
          stopPolling();
          setStatus('paid');
          setMessage('Payment confirmed. Your account has been updated.');
          setTimeout(() => router.refresh(), 800);
        } else if (next === 'failed' || next === 'initiation_failed') {
          stopPolling();
          setStatus('failed');
          setMessage('The M-Pesa payment did not complete. You can try again.');
        } else {
          pollTimer.current = setTimeout(checkStatus, 2000);
        }
      } catch {
        pollTimer.current = setTimeout(checkStatus, 2000);
      }
    };
    void checkStatus();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('sending');
    setMessage(null);
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type, phone })
      });
      const data = (await response.json().catch(() => ({}))) as { paymentId?: string; message?: string; error?: string };
      if (!response.ok || !data.paymentId) {
        setStatus('failed');
        setMessage(data.error ?? 'Could not start the payment.');
        return;
      }
      setStatus('pending');
      setMessage(data.message ?? 'Check your phone and enter your M-Pesa PIN.');
      poll(data.paymentId);
    } catch {
      setStatus('failed');
      setMessage('Could not reach the server. Please try again.');
    }
  }

  const busy = status === 'sending' || status === 'pending';

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-bold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <span className="whitespace-nowrap font-display text-lg font-extrabold">{formatKes(amountKes)}</span>
        </div>

        {status === 'paid' ? (
          <p className="mt-4 rounded-md bg-accent/40 px-3 py-2 text-sm text-accent-foreground">{message}</p>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label htmlFor={`phone-${type}`}>M-Pesa phone number</Label>
              <Input
                id={`phone-${type}`}
                name="phone"
                inputMode="tel"
                placeholder="0712345678"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                disabled={busy}
                required
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {status === 'sending' ? 'Sending prompt…' : status === 'pending' ? 'Waiting for confirmation…' : ctaLabel}
            </Button>
            {message ? (
              <p className={`text-sm ${status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>{message}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Enter your PIN only in the official M-Pesa prompt on your phone. EarnChat never sees your PIN.
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
