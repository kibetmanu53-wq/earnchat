'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatKes } from '@/lib/utils';

export interface PaymentHistoryItem {
  id: string;
  type: string;
  amountKes: number;
  status: string;
  providerReference: string | null;
  createdAt: string | Date;
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  verification: 'Verification',
  beginner_membership: 'Beginner membership',
  withdrawal_fee: 'Withdrawal fee'
};

const STATUS_VARIANT: Record<string, 'default' | 'accent' | 'muted' | 'destructive'> = {
  paid: 'accent',
  pending: 'muted',
  initiating: 'muted',
  failed: 'destructive',
  cancelled: 'muted',
  initiation_failed: 'destructive'
};

const STATUS_LABELS: Record<string, string> = {
  paid: 'Paid',
  pending: 'Pending',
  initiating: 'Starting',
  failed: 'Failed',
  cancelled: 'Cancelled',
  initiation_failed: 'Could not start'
};

export function PaymentHistory({
  initialPayments,
  initialNextCursor
}: {
  initialPayments: PaymentHistoryItem[];
  initialNextCursor: string | null;
}) {
  const signature = `${initialNextCursor ?? ''}|${initialPayments.map((p) => `${p.id}:${p.status}`).join(',')}`;
  const [page, setPage] = useState({ payments: initialPayments, cursor: initialNextCursor, signature });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resync when the server sends a fresh first page (e.g. after router.refresh()
  // following a settled payment), discarding any pages loaded since.
  if (signature !== page.signature) {
    setPage({ payments: initialPayments, cursor: initialNextCursor, signature });
  }

  async function loadMore() {
    if (!page.cursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/payments?cursor=${encodeURIComponent(page.cursor)}`);
      const data = (await response.json().catch(() => ({}))) as {
        payments?: PaymentHistoryItem[];
        nextCursor?: string | null;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? 'Could not load more payments.');
        return;
      }
      setPage((previous) => ({
        payments: [...previous.payments, ...(data.payments ?? [])],
        cursor: data.nextCursor ?? null,
        signature: previous.signature
      }));
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (page.payments.length === 0) {
    return <p className="mt-3 text-sm text-muted-foreground">No payments yet.</p>;
  }

  return (
    <div>
      <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
        {page.payments.map((payment) => (
          <li key={payment.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span className="min-w-0">
              <span className="block truncate font-medium">{PAYMENT_TYPE_LABELS[payment.type] ?? payment.type}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {payment.providerReference
                  ? `Ref ${payment.providerReference}`
                  : new Date(payment.createdAt).toLocaleDateString('en-KE')}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="font-semibold">{formatKes(payment.amountKes)}</span>
              <Badge variant={STATUS_VARIANT[payment.status] ?? 'muted'}>
                {STATUS_LABELS[payment.status] ?? payment.status}
              </Badge>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-col items-center gap-2">
        {page.cursor ? (
          <Button variant="outline" size="sm" className="w-full" onClick={loadMore} disabled={loading}>
            {loading ? 'Loading…' : 'Load More'}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">You have reached the end.</p>
        )}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
