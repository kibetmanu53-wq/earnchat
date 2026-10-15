import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { HOW_IT_WORKS } from '@/lib/marketing';

export const metadata = { title: 'How EarnChat works' };

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">How it works</p>
      <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
        From sign-up to payout in three steps
      </h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        EarnChat is built around eligible conversations. Here is exactly what happens from the moment you create an account.
      </p>

      <div className="mt-12 space-y-6">
        {HOW_IT_WORKS.map((item) => (
          <Card key={item.step}>
            <CardContent className="flex gap-5 p-6">
              <div className="font-mono text-2xl font-medium text-[#7ea832]">{item.step}</div>
              <div>
                <h2 className="font-display text-xl font-bold">{item.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-12 rounded-xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-bold">What makes a chat eligible?</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>• It lasts at least 5 minutes.</li>
          <li>• Every participant is a verified account.</li>
          <li>• It is credited from our trusted server, never from the browser.</li>
          <li>• Duplicate chats are rejected automatically.</li>
        </ul>
      </div>

      <div className="mt-10">
        <Button asChild size="lg">
          <Link href="/sign-up">
            Create your free account <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
