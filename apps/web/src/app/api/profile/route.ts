import { NextResponse } from 'next/server';
import { getDashboard, updateProfile } from '@earnchat/core';
import { profileSchema } from '@earnchat/validation';
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

    await enforceRateLimit(request, 'profile', 30, 15 * 60_000, user.id);

    const parsed = profileSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid profile details.' },
        { status: 400 }
      );
    }

    const updated = await updateProfile(user.id, parsed.data);
    return jsonOk({ user: await getDashboard(updated) });
  } catch (error) {
    return jsonError(error);
  }
}
