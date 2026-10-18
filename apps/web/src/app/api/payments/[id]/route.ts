import { NextResponse } from 'next/server';
import { confirmPaymentByQuery, getPayment } from '@earnchat/core';
import { getMpesaClient } from '@earnchat/payments';
import { jsonError, jsonOk } from '@/lib/http';
import { getCurrentUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Sign in is required.' }, { status: 401 });

    const { id } = await params;
    let payment = await getPayment(id);
    if (!payment || payment.userId !== user.id) {
      return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
    }

    if (payment.status === 'pending') {
      payment = (await confirmPaymentByQuery(payment.id, getMpesaClient())) ?? payment;
    }

    return jsonOk({
      payment: {
        id: payment.id,
        type: payment.type,
        amountKes: payment.amountKes,
        status: payment.status,
        providerReference: payment.providerReference,
        createdAt: payment.createdAt
      }
    });
  } catch (error) {
    return jsonError(error);
  }
}
