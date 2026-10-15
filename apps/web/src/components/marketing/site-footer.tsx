import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="font-display text-xl font-extrabold tracking-tight">
            earn<span className="text-[#7ea832]">chat</span>
          </div>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            A chat-and-earn platform. Verify with M-Pesa, choose a plan, and earn from eligible conversations.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Product</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link href="/how-it-works" className="hover:text-foreground">How it works</Link></li>
            <li><Link href="/pricing" className="hover:text-foreground">Pricing</Link></li>
            <li><Link href="/faq" className="hover:text-foreground">FAQ</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Account</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link href="/sign-up" className="hover:text-foreground">Create account</Link></li>
            <li><Link href="/sign-in" className="hover:text-foreground">Sign in</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-5 text-center text-xs text-muted-foreground">
        EarnChat is a prototype. M-Pesa payments use Safaricom Daraja. Enter your PIN only in the official M-Pesa prompt.
      </div>
    </footer>
  );
}
