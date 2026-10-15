import Link from 'next/link';
import { getDashboard } from '@earnchat/core';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PEOPLE } from '@/lib/sample-data';
import { getCurrentUser } from '@/lib/session';
import { formatKes } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const PLAN_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  advanced: 'Advanced',
  premium: 'Premium'
};

export default async function InboxPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const dashboard = await getDashboard(user);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete 5-minute chats to earn up to {formatKes(2500)} each.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={user.verified ? 'accent' : 'muted'}>{user.verified ? 'Verified' : 'Unverified'}</Badge>
          <Badge variant="muted">{user.membershipPlan ? PLAN_LABELS[user.membershipPlan] : 'No plan'}</Badge>
          <Link href="/wallet" className="text-sm font-semibold text-primary hover:underline">
            {formatKes(dashboard.earningsBalanceKes)} balance →
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {PEOPLE.map((person) => {
          const last = person.messages[person.messages.length - 1];
          return (
            <Link key={person.id} href={`/chat/${person.id}`} className="block">
              <Card className="transition-colors hover:border-primary/40 hover:bg-muted/40">
                <CardContent className="flex items-center gap-4 p-4">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-foreground"
                    style={{ background: person.color }}
                  >
                    {person.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate font-semibold">{person.name}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">{last?.time}</span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{last?.text}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{person.topic}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {!user.verified ? (
        <Card className="mt-6 border-primary/30 bg-accent/20">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm">Verify your account with a one-time {formatKes(150)} M-Pesa payment to start earning.</p>
            <Link href="/wallet" className="text-sm font-semibold text-primary hover:underline">
              Go to wallet →
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
