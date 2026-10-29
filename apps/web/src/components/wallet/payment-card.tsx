'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeKenyanPhone } from '@earnchat/domain';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatKes } from '@/lib/utils';

type Status = 'idle' | 'sending' | 'pending' | 'paid' | 'failed' | 'cancelled';

const TERMINAL_MESSAGES: Record<'failed' | 'cancelled', string> = {
  failed: 'The M-Pesa payment did not complete. You can try again.',
  cancelled: 'The M-Pesa prompt was cancelled. You can try again when ready.'
};

// A status endpoint that keeps failing must stop the poll loop and tell the
// user, instead of retrying forever every couple of seconds.
const MAX_STATUS_FAILURES = 4;
const STATUS_RETRY_DELAY_MS = 5000;

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
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusFailures = useRef(0);

  useEffect(
    () => () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    },
    []
  );

  function stopPolling() {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }

  function scheduleCheck(id: string, delayMs = 2000) {
    stopPolling();
    pollTimer.current = setTimeout(() => void checkStatus(id), delayMs);
  }

  function failStatus(message: string) {
    stopPolling();
    setStatus('failed');
    setMessage(message);
  }

  function applyStatus(next: string | undefined, id: string): boolean {
    if (next === 'paid') {
      stopPolling();
      setStatus('paid');
      setMessage('Payment confirmed. Your account has been updated.');
      setTimeout(() => router.refresh(), 800);
      return true;
    }
    if (next === 'failed' || next === 'initiation_failed') {
      stopPolling();
      setStatus('failed');
      setMessage(TERMINAL_MESSAGES.failed);
      return true;
    }
    if (next === 'cancelled') {
      stopPolling();
      setStatus('cancelled');
      setMessage(TERMINAL_MESSAGES.cancelled);
      return true;
    }
    setStatus('pending');
    scheduleCheck(id);
    return false;
  }

  async function checkStatus(id: string) {
    try {
      const response = await fetch(`/api/payments/${id}`, { cache: 'no-store' });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        const retryable = response.status >= 500 || response.status === 429;
        if (retryable && statusFailures.current < MAX_STATUS_FAILURES) {
          statusFailures.current += 1;
          scheduleCheck(id, STATUS_RETRY_DELAY_MS);
          return;
        }
        failStatus(data.error ?? `Could not check the payment status (HTTP ${response.status}).`);
        return;
      }
      statusFailures.current = 0;
      const data = (await response.json()) as { payment?: { status?: string } };
      applyStatus(data.payment?.status, id);
    } catch {
      if (statusFailures.current < MAX_STATUS_FAILURES) {
        statusFailures.current += 1;
        scheduleCheck(id, STATUS_RETRY_DELAY_MS);
        return;
      }
      failStatus('Could not reach the server to check the payment status. Refresh the page to try again.');
    }
  }

  async function refreshStatus() {
    if (!paymentId || checking) return;
    setChecking(true);
    try {
      await checkStatus(paymentId);
    } finally {
      setChecking(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    stopPolling();

    const normalized = normalizeKenyanPhone(phone);
    if (!normalized) {
      setStatus('failed');
      setMessage('Enter a valid Kenyan M-Pesa number, such as 0712345678.');
      return;
    }

    setStatus('sending');
    setMessage(null);
    statusFailures.current = 0;
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type, phone: normalized })
      });
      const data = (await response.json().catch(() => ({}))) as {
        paymentId?: string;
        message?: string;
        error?: string;
      };
      if (!response.ok || !data.paymentId) {
        setStatus('failed');
        setMessage(data.error ?? 'Could not start the payment.');
        return;
      }
      setPaymentId(data.paymentId);
      setStatus('pending');
      setMessage(data.message ?? 'Check your phone and enter your M-Pesa PIN.');
      scheduleCheck(data.paymentId);
    } catch {
      setStatus('failed');
      setMessage('Could not reach the server. Please try again.');
    }
  }

  const busy = status === 'sending' || status === 'pending';
  const failed = status === 'failed' || status === 'cancelled';

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
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0712345678"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                disabled={busy}
                aria-invalid={failed && !normalizeKenyanPhone(phone) ? true : undefined}
                required
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {status === 'sending' ? 'Sending prompt…' : status === 'pending' ? 'Waiting for confirmation…' : ctaLabel}
            </Button>
            {status === 'pending' && paymentId ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => void refreshStatus()}
                disabled={checking}
              >
                {checking ? 'Checking…' : "I've paid — check status"}
              </Button>
            ) : null}
            {message ? (
              <p className={`text-sm ${failed ? 'text-destructive' : 'text-muted-foreground'}`}>{message}</p>
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
