import { handleMpesaCallback, type MpesaCallbackEvent } from '@earnchat/core';
import { getMpesaClient } from '@earnchat/payments';
import { jsonError, jsonOk, readJson } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Safaricom Daraja STK callback. Unauthenticated by design (Daraja does not
 * sign callbacks), so the stored payment is re-validated and confirmed with an
 * authoritative STK Query before any entitlement is granted.
 */
export async function POST(request: Request) {
  try {
    const event = (await readJson(request)) as MpesaCallbackEvent;
    await handleMpesaCallback(event, getMpesaClient());
    return jsonOk({ ResultCode: 0, ResultDesc: 'Callback received.' });
  } catch (error) {
    return jsonError(error);
  }
}
