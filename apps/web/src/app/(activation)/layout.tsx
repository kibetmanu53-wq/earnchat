import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LogoutButton } from '@/components/logout-button';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function ActivationLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');
  if (user.verified) redirect('/inbox');

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground font-display text-lg font-extrabold text-accent">
            e
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight">
            earn<span className="text-[#7ea832]">chat</span>
          </span>
        </Link>
        {children}
        <div className="mt-4 flex justify-center">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
