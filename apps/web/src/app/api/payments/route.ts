import { NextResponse } from 'next/server';
import { startPayment } from '@earnchat/core';
import { getMpesaClient } from '@earnchat/payments';
import { paymentInitiateSchema } from '@earnchat/validation';
import { jsonError, jsonOk, readJson } from '@/lib/http';
import { getCurrentUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Sign in is required.' }, { status: 401 });

    const parsed = paymentInitiateSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input.' }, { status: 400 });
    }

    const payment = await startPayment({
      userId: user.id,
      type: parsed.data.type,
      phone: parsed.data.phone,
      mpesa: getMpesaClient()
    });

    return jsonOk(
      {
        paymentId: payment.id,
        type: payment.type,
        amountKes: payment.amountKes,
        status: payment.status,
        message: `M-Pesa prompt sent to ${payment.phone}. Enter your PIN only in the official M-Pesa prompt.`
      },
      202
    );
  } catch (error) {
    return jsonError(error);
  }
}
