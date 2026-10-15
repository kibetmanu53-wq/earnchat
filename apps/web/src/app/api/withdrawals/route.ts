import { NextResponse } from 'next/server';
import { listWithdrawals, requestWithdrawal } from '@earnchat/core';
import { withdrawalSchema } from '@earnchat/validation';
import { jsonError, jsonOk, readJson } from '@/lib/http';
import { getCurrentUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Sign in is required.' }, { status: 401 });
    return jsonOk({ withdrawals: await listWithdrawals(user.id) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Sign in is required.' }, { status: 401 });

    const parsed = withdrawalSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Enter a valid withdrawal amount.' }, { status: 400 });
    }

    await requestWithdrawal({ userId: user.id, amountKes: parsed.data.amountKes, phone: parsed.data.phone });
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
