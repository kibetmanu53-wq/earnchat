import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-display text-5xl font-extrabold tracking-tight text-[#7ea832]">404</p>
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The page you were looking for does not exist or may have been moved.
      </p>
      <Link href="/" className={buttonVariants({ variant: 'accent' })}>
        Back home
      </Link>
    </main>
  );
}
