import { NextResponse } from 'next/server';
import { handleNexusPayWebhook } from '@earnchat/core';
import { logger } from '@earnchat/logger';
import { loadNexusPayConfig, parseNexusPayWebhook, verifyNexusPaySignature } from '@earnchat/payments';
import { jsonError } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const log = logger.child({ component: 'nexus-pay-webhook' });
const MAX_BODY_BYTES = 64 * 1024;
const ACK = { received: true } as const;

/**
 * Nexus Pay (Makamesco) webhook.
 *
 * Every request is authenticated with the documented
 * `X-Webhook-Signature: sha256=<hex HMAC-SHA256(rawBody, webhookSecret)>`
 * header before the body is parsed. Only a verified `payment.completed` event
 * can grant an entitlement, and the stored payment is re-validated for
 * provider, checkout/transaction/account reference, phone, and amount.
 *
 * Successful and intentionally ignored deliveries return 200 so Nexus Pay does
 * not retry them. Genuine internal failures return 5xx so the delivery is
 * retried.
 */
export async function POST(request: Request) {
  const config = loadNexusPayConfig();
  if (!config.webhookSecret) {
    log.error('NEXUS_PAY_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 503 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    log.warn('could not read webhook body');
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 });
  }

  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    log.warn('rejected oversized webhook body');
    return NextResponse.json({ error: 'Payload too large.' }, { status: 413 });
  }

  if (!verifyNexusPaySignature(rawBody, request.headers.get('x-webhook-signature'), config.webhookSecret)) {
    log.warn('rejected webhook with invalid signature');
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    log.warn('rejected webhook with invalid JSON');
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const event = parseNexusPayWebhook(payload);
  if (!event) {
    // Unsupported events (and malformed payloads) will never succeed on retry.
    log.info('acknowledging webhook that is not actionable');
    return NextResponse.json({ ...ACK, ignored: true });
  }

  try {
    const payment = await handleNexusPayWebhook(event);
    if (!payment) {
      log.info('acknowledging webhook for unknown payment', {
        event: event.event,
        checkoutRequestId: event.data.checkoutRequestId
      });
      return NextResponse.json({ ...ACK, ignored: true });
    }
    log.info('processed Nexus Pay webhook', {
      event: event.event,
      paymentId: payment.id,
      status: payment.status
    });
    return NextResponse.json(ACK);
  } catch (error) {
    return jsonError(error);
  }
}
