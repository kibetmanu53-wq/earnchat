'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Unhandled application error:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-display text-5xl font-extrabold tracking-tight text-[#7ea832]">Oops</p>
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        We hit an unexpected error. Try again — if it keeps happening, please come back shortly.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="accent" onClick={reset}>
          Try again
        </Button>
        <Link href="/" className={buttonVariants({ variant: 'outline' })}>
          Back home
        </Link>
      </div>
    </main>
  );
}
