import Link from 'next/link';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { HOW_IT_WORKS, PLANS } from '@/lib/marketing';

const STATS = [
  { value: 'KSh 1,300+', label: 'Earned per eligible chat' },
  { value: '5 min', label: 'Minimum eligible chat' },
  { value: '100%', label: 'M-Pesa secured payments' }
];

export default function LandingPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="accent" className="mx-auto">Chat-and-earn, built for Kenya</Badge>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              Good conversations
              <br />
              <span className="text-[#7ea832]">pay off.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              EarnChat connects you with real people for genuine conversations — and pays you in KSh for every eligible
              chat. Verify with M-Pesa and start earning today.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/sign-up">
                  Create your free account <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <Link href="/how-it-works">See how it works</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Free to join · One-time KSh 150 verification · Enter your PIN only in the official M-Pesa prompt
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
            {STATS.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border bg-card px-5 py-4 text-center">
                <div className="font-display text-2xl font-bold">{stat.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="border-y border-border bg-card py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-xl">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">How it works</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Three steps to your first payout
            </h2>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {HOW_IT_WORKS.map((item) => (
              <Card key={item.step}>
                <CardContent className="p-6">
                  <div className="font-mono text-sm text-[#7ea832]">{item.step}</div>
                  <h3 className="mt-3 font-display text-lg font-bold">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-8">
            <Button asChild>
              <Link href="/sign-up">
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-xl">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Pricing</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Simple, transparent plans
            </h2>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {PLANS.map((plan) => (
              <Card key={plan.name} className={plan.highlight ? 'border-primary shadow-md ring-1 ring-primary' : ''}>
                <CardContent className="flex h-full flex-col p-6">
                  {plan.highlight ? <Badge className="w-fit">Most popular</Badge> : null}
                  <h3 className="mt-3 font-display text-xl font-bold">{plan.name}</h3>
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
        </div>
      </section>

      <section className="border-t border-border bg-card py-20">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-4 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 text-[#7ea832]">
              <ShieldCheck className="h-5 w-5" />
              <span className="font-mono text-xs uppercase tracking-widest">Safe by design</span>
            </div>
            <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Your money and your PIN stay protected
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Payments run through Safaricom Daraja. Every successful transaction is verified against the expected amount,
              phone number, and receipt before your account is activated.
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/sign-up">
              Create free account <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
