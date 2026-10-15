import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FAQS } from '@/lib/marketing';

export const metadata = { title: 'EarnChat FAQ' };

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">FAQ</p>
      <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Questions, answered</h1>

      <div className="mt-10 divide-y divide-border rounded-xl border border-border bg-card">
        {FAQS.map((item) => (
          <details key={item.q} className="group px-6 py-5">
            <summary className="cursor-pointer list-none font-semibold marker:content-none">
              <span className="flex items-center justify-between gap-4">
                {item.q}
                <span className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
              </span>
            </summary>
            <p className="mt-3 text-sm text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>

      <div className="mt-10">
        <Button asChild size="lg">
          <Link href="/sign-up">Create your free account</Link>
        </Button>
      </div>
    </div>
  );
}
