import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
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
      </div>
    </div>
  );
}
