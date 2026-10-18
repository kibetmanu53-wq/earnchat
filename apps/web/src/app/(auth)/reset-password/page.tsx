import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata = { title: 'Reset password — EarnChat' };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={token ?? ''} />;
}
