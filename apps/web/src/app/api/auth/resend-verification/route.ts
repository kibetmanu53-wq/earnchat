import { NextResponse } from 'next/server';
import { sendEmailVerification } from '@earnchat/core';
import { jsonError, jsonOk } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getCurrentUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Sign in is required.' }, { status: 401 });

    await enforceRateLimit(request, 'resend-verification', 5, 15 * 60_000, user.id);

    const alreadyVerified = Boolean(user.emailVerifiedAt);
    if (!alreadyVerified) {
      await sendEmailVerification(user);
    }

    return jsonOk({ ok: true, email: user.email, alreadyVerified });
  } catch (error) {
    return jsonError(error);
  }
}
