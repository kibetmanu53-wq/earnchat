import { NextResponse } from 'next/server';
import { listUserPayments, startPayment } from '@earnchat/core';
import { getMpesaClient } from '@earnchat/payments';
import { paymentHistoryQuerySchema, paymentInitiateSchema } from '@earnchat/validation';
import { jsonError, jsonOk, readJson } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getCurrentUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Sign in is required.' }, { status: 401 });

    const params = new URL(request.url).searchParams;
    const parsed = paymentHistoryQuerySchema.safeParse({
      limit: params.get('limit') ?? undefined,
      cursor: params.get('cursor') ?? undefined
    });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid query.' }, { status: 400 });
    }

    const page = await listUserPayments(user.id, {
      limit: parsed.data.limit,
      cursor: parsed.data.cursor ?? null
    });

    return jsonOk({ payments: page.items, nextCursor: page.nextCursor });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Sign in is required.' }, { status: 401 });

    await enforceRateLimit(request, 'payment-initiate', 10, 15 * 60_000, user.id);

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
