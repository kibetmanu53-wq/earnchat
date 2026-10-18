import { NextResponse } from 'next/server';
import { resetPassword } from '@earnchat/core';
import { resetPasswordSchema } from '@earnchat/validation';
import { jsonError, jsonOk, readJson } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, 'reset-password', 10, 15 * 60_000);

    const parsed = resetPasswordSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'This reset link is invalid or has expired.' },
        { status: 400 }
      );
    }

    await resetPassword(parsed.data.token, parsed.data.password);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
