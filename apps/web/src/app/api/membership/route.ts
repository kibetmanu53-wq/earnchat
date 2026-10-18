import { NextResponse } from 'next/server';
import { getDashboard, setMembershipPlan } from '@earnchat/core';
import { membershipSchema } from '@earnchat/validation';
import { jsonError, jsonOk, readJson } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getCurrentUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Sign in is required.' }, { status: 401 });
    if (!user.verified) {
      return NextResponse.json({ error: 'Activate your account to continue.' }, { status: 403 });
    }

    await enforceRateLimit(request, 'membership', 20, 15 * 60_000, user.id);

    const parsed = membershipSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Choose Advanced or Premium.' }, { status: 400 });
    }

    const updated = await setMembershipPlan(user.id, parsed.data.plan);
    return jsonOk({ user: await getDashboard(updated) });
  } catch (error) {
    return jsonError(error);
  }
}
