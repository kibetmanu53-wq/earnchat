'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { formatKes } from '@/lib/utils';

const PLANS = [
  { plan: 'advanced' as const, label: 'Advanced', perChat: 1300 },
  { plan: 'premium' as const, label: 'Premium', perChat: 2500 }
];

export function MembershipActions({ current }: { current: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(plan: 'advanced' | 'premium') {
    setPending(plan);
    setError(null);
    try {
      const response = await fetch('/api/membership', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan })
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Could not update your plan.');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {PLANS.map((item) => {
          const active = current === item.plan;
          return (
            <div
              key={item.plan}
              className={`rounded-lg border p-4 ${active ? 'border-primary bg-accent/30' : 'border-border'}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display font-bold">{item.label}</span>
                {active ? <span className="text-xs font-semibold text-[#5f8a1f]">Active</span> : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{formatKes(item.perChat)} per eligible chat</p>
              <Button
                variant={active ? 'outline' : 'default'}
                size="sm"
                className="mt-3 w-full"
                disabled={active || pending !== null || current === 'beginner'}
                onClick={() => choose(item.plan)}
              >
                {active ? 'Selected' : pending === item.plan ? 'Updating…' : `Choose ${item.label}`}
              </Button>
            </div>
          );
        })}
      </div>
      {current === 'beginner' ? (
        <p className="text-xs text-muted-foreground">A paid Beginner membership is active and cannot be replaced.</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
