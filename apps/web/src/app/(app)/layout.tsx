import { redirect } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';
import { LogoutButton } from '@/components/logout-button';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border p-4 md:flex">
        <div className="px-3 py-2 font-display text-lg font-extrabold tracking-tight">
          earn<span className="text-[#7ea832]">chat</span>
        </div>
        <div className="mt-4 flex-1">
          <AppSidebar />
        </div>
        <div className="border-t border-border pt-3">
          <div className="px-3 py-1">
            <p className="truncate text-sm font-semibold">{user.displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <LogoutButton className="mt-1 w-full justify-start" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-4 md:hidden">
          <span className="font-display text-lg font-extrabold tracking-tight">
            earn<span className="text-[#7ea832]">chat</span>
          </span>
          <LogoutButton />
        </header>
        <main className="flex-1">{children}</main>
        <nav className="sticky bottom-0 border-t border-border bg-card md:hidden">
          <AppSidebar variant="bar" />
        </nav>
      </div>
    </div>
  );
}
