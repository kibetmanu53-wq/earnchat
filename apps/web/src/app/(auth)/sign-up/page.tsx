import { AuthForm } from '@/components/auth-form';

export const metadata = { title: 'Create your account — EarnChat' };

export default function SignUpPage() {
  return <AuthForm mode="sign-up" />;
}
