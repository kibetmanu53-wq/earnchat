import Link from 'next/link';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PLANS } from '@/lib/marketing';

export const metadata = { title: 'EarnChat pricing' };

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Pricing</p>
        <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          Pay once, or earn per chat
        </h1>
        <p className="mt-4 text-muted-foreground">
          Start with a one-time KSh 150 verification. Then pick the plan that matches how much you want to earn.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <Card key={plan.name} className={plan.highlight ? 'border-primary shadow-md ring-1 ring-primary' : ''}>
            <CardContent className="flex h-full flex-col p-6">
              {plan.highlight ? <Badge className="w-fit">Most popular</Badge> : null}
              <h2 className="mt-3 font-display text-xl font-bold">{plan.name}</h2>
              <div className="mt-3">
                <span className="font-display text-2xl font-extrabold">{plan.price}</span>{' '}
                <span className="text-xs text-muted-foreground">{plan.cadence}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
              <ul className="mt-5 flex-1 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#7ea832]" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-6 w-full" variant={plan.highlight ? 'default' : 'outline'}>
                <Link href="/sign-up">{plan.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-10 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <h2 className="font-display text-lg font-bold text-foreground">Withdrawals</h2>
        <p className="mt-2">
          Withdraw once you have at least <strong className="text-foreground">KSh 3,500</strong> in eligible available
          earnings. A separate <strong className="text-foreground">KSh 50</strong> processing fee is displayed before
          confirmation. Withdrawals remain disabled until an authorized M-Pesa payout service is configured.
        </p>
      </div>
    </div>
  );
}
