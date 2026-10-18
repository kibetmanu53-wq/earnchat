import { FEE_AMOUNTS_KES } from '@earnchat/domain';
import { PaymentCard } from '@/components/wallet/payment-card';
import { getCurrentUser } from '@/lib/session';
import { formatKes } from '@/lib/utils';

export const metadata = { title: 'Activate your account — EarnChat' };
export const dynamic = 'force-dynamic';

export default async function ActivatePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Activate your account</h1>
      <p className="mb-5 mt-2 text-sm text-muted-foreground">
        Welcome, {user.displayName}. Pay a one-time activation fee of {formatKes(FEE_AMOUNTS_KES.verification)} via
        M-Pesa to unlock your EarnChat dashboard.
      </p>
      <PaymentCard
        type="verification"
        amountKes={FEE_AMOUNTS_KES.verification}
        title="Activation key"
        description="A one-time M-Pesa payment unlocks earning and membership."
        ctaLabel={`Pay ${formatKes(FEE_AMOUNTS_KES.verification)}`}
      />
    </div>
  );
}
