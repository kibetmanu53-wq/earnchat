import { VerifyEmail } from '@/components/auth/verify-email';

export const metadata = { title: 'Verify email — EarnChat' };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <VerifyEmail token={token ?? ''} />;
}
