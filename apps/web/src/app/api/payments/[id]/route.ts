import { NextResponse } from 'next/server';
import { confirmPaymentByQuery, getPayment } from '@earnchat/core';
import { logger } from '@earnchat/logger';
import { getPaymentClientForProvider, isPaymentProvider, MpesaError } from '@earnchat/payments';
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

    if (payment.status === 'pending' && isPaymentProvider(payment.provider)) {
      try {
        payment = (await confirmPaymentByQuery(payment.id, getPaymentClientForProvider(payment.provider))) ?? payment;
      } catch (error) {
        // A provider that is unreachable or unconfigured must not turn a status
        // read into a 500; report the last state we recorded instead.
        logger.warn('Could not confirm payment with provider', {
          paymentId: payment.id,
          provider: payment.provider,
          error
        });
        if (!(error instanceof MpesaError)) throw error;
      }
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
