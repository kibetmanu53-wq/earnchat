import { getDashboard } from '@earnchat/core';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ProfileForm } from '@/components/profile/profile-form';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const PLAN_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  advanced: 'Advanced',
  premium: 'Premium'
};

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const dashboard = await getDashboard(user);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">Keep your details up to date so matches trust you.</p>

      <Card className="mt-6">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="font-semibold">{user.email}</p>
            <p className="text-xs text-muted-foreground">Joined {new Date(user.createdAt).toLocaleDateString('en-KE')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={user.verified ? 'accent' : 'muted'}>{user.verified ? 'Verified' : 'Unverified'}</Badge>
            <Badge variant="muted">{user.membershipPlan ? PLAN_LABELS[user.membershipPlan] : 'No plan'}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="p-5">
          <h2 className="mb-4 font-display text-lg font-bold">Edit details</h2>
          <ProfileForm
            initial={{
              displayName: user.displayName,
              age: user.age,
              location: user.location,
              bio: user.bio,
              interests: user.interests
            }}
          />
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        Eligible earnings balance: {dashboard.earningsBalanceKes.toLocaleString('en-KE')} KSh
      </p>
    </div>
  );
}
