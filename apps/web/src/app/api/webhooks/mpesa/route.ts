import { NextResponse } from 'next/server';
import { AppError, handleMpesaCallback, type MpesaCallbackEvent } from '@earnchat/core';
import { logger } from '@earnchat/logger';
import { getMpesaClient, isIpAllowed, parseIpAllowlist } from '@earnchat/payments';
import { jsonError, jsonOk, readJson } from '@/lib/http';
import { getClientIp } from '@/lib/request-ip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const log = logger.child({ component: 'mpesa-webhook' });
const ACK = { ResultCode: 0, ResultDesc: 'Callback received.' } as const;

/**
 * Safaricom Daraja STK callback. Unauthenticated by design (Daraja does not
 * sign callbacks), so the stored payment is re-validated and confirmed with an
 * authoritative STK Query before any entitlement is granted.
 *
 * Daraja retries any non-2xx response, so we acknowledge (200) every callback we
 * can parse but will never act on — unknown payments, malformed bodies, and
 * validation errors — and only return 5xx for genuine internal failures, which
 * are worth retrying.
 */
export async function POST(request: Request) {
  const allowlist = parseIpAllowlist(process.env.MPESA_WEBHOOK_ALLOWED_IPS);
  if (allowlist.length > 0 && !isIpAllowed(getClientIp(request), allowlist)) {
    log.warn('rejected callback from disallowed source', { ip: getClientIp(request) });
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  let event: MpesaCallbackEvent;
  try {
    event = (await readJson(request)) as MpesaCallbackEvent;
  } catch {
    log.warn('acknowledging unparseable callback body');
    return jsonOk(ACK);
  }

  try {
    await handleMpesaCallback(event, getMpesaClient());
    return jsonOk(ACK);
  } catch (error) {
    if (error instanceof AppError && error.status < 500) {
      log.warn('ignoring callback that will never succeed on retry', { code: error.code, message: error.message });
      return jsonOk(ACK);
    }
    return jsonError(error);
  }
}
