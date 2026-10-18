import { NextResponse } from 'next/server';
import { verifyEmailToken } from '@earnchat/core';
import { verifyEmailSchema } from '@earnchat/validation';
import { jsonError, jsonOk, readJson } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, 'verify-email', 30, 15 * 60_000);

    const parsed = verifyEmailSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: 'This verification link is invalid or has expired.' }, { status: 400 });
    }

    const user = await verifyEmailToken(parsed.data.token);
    return jsonOk({ ok: true, email: user.email });
  } catch (error) {
    return jsonError(error);
  }
}
