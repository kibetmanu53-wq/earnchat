'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Inbox, UserRound, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/profile', label: 'Profile', icon: UserRound }
];

export function AppSidebar({ variant = 'sidebar' }: { variant?: 'sidebar' | 'bar' }) {
  const pathname = usePathname();
  return (
    <nav
      className={cn('flex gap-1', variant === 'sidebar' ? 'flex-col' : 'flex-row items-center justify-around')}
    >
      {ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              variant === 'bar' ? 'flex-col gap-1 px-4 text-xs' : '',
              active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
