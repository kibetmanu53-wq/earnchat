import {
  CHAT_EARNINGS_KES,
  FEE_AMOUNTS_KES,
  MINIMUM_WITHDRAWAL_KES,
  WITHDRAWAL_FEE_KES
} from '@earnchat/domain';
import { getDashboard } from '@earnchat/core';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { MembershipActions } from '@/components/wallet/membership-actions';
import { PaymentCard } from '@/components/wallet/payment-card';
import { PaymentHistory } from '@/components/wallet/payment-history';
import { getCurrentUser } from '@/lib/session';
import { formatKes } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function WalletPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const dashboard = await getDashboard(user);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Wallet</h1>
      <p className="mt-1 text-sm text-muted-foreground">Track your earnings, fees, and payments.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Eligible earnings</p>
            <p className="mt-2 font-display text-2xl font-extrabold">{formatKes(dashboard.earningsBalanceKes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Available to withdraw</p>
            <p className="mt-2 font-display text-2xl font-extrabold text-[#5f8a1f]">
              {formatKes(dashboard.availableToWithdrawKes)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Fees paid</p>
            <p className="mt-2 font-display text-2xl font-extrabold">{formatKes(dashboard.paidFeesKes)}</p>
          </CardContent>
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="font-display text-lg font-bold">Account activation</h2>
        <div className="mt-3 space-y-3">
          <Card>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="font-semibold">Identity verification</p>
                <p className="text-sm text-muted-foreground">Your account is verified.</p>
              </div>
              <Badge variant="accent">Verified</Badge>
            </CardContent>
          </Card>

          {!user.membershipPlan ? (
            <PaymentCard
              type="beginner_membership"
              amountKes={FEE_AMOUNTS_KES.beginner_membership}
              title="Beginner membership"
              description="Optional one-time membership with the core chat experience."
              ctaLabel={`Pay ${formatKes(FEE_AMOUNTS_KES.beginner_membership)}`}
            />
          ) : null}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg font-bold">Membership plan</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Earn {formatKes(CHAT_EARNINGS_KES.advanced)} (Advanced) or {formatKes(CHAT_EARNINGS_KES.premium)} (Premium)
          per eligible chat. No upfront fee.
        </p>
        <div className="mt-3">
          <MembershipActions current={user.membershipPlan} />
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-lg font-bold">Eligible chats</h2>
          {dashboard.eligibleChats.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No eligible chats yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
              {dashboard.eligibleChats.map((chat) => (
                <li key={chat.chatReference} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="truncate text-muted-foreground">
                    {chat.chatReference} · {chat.completedMinutes} min
                  </span>
                  <span className="font-semibold text-[#5f8a1f]">+{formatKes(chat.amountKes)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="font-display text-lg font-bold">Recent payments</h2>
          <PaymentHistory
            initialPayments={dashboard.recentPayments}
            initialNextCursor={dashboard.recentPaymentsNextCursor}
          />
        </div>
      </section>

      <section className="mt-8">
        <Card className="border-dashed">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Withdrawals</h2>
              <Badge variant="muted">Temporarily disabled</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Withdraw once you have at least {formatKes(MINIMUM_WITHDRAWAL_KES)} available. A separate{' '}
              {formatKes(WITHDRAWAL_FEE_KES)} processing fee applies. Withdrawals stay disabled until an authorized M-Pesa
              payout service is configured.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
