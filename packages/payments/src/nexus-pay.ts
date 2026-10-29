import { createHmac, timingSafeEqual } from 'node:crypto';
import { normalizeKenyanPhone } from '@earnchat/domain';
import {
  MpesaError,
  type MpesaClient,
  type ProviderTransactionStatus,
  type StkPushRequest,
  type StkPushResult,
  type StkQueryResult
} from './types';

/**
 * Nexus Pay (Makamesco) API contract, as documented in the provider's
 * dashboard developer guide:
 *
 * - POST /api/payments/stkpush                  (X-API-Key auth)
 * - GET  /api/payments/status/:checkoutRequestId (X-API-Key auth)
 * - Webhooks signed as `sha256=<hex HMAC-SHA256(rawBody, webhookSecret)>`
 *   in the X-Webhook-Signature header.
 *
 * No endpoint, field, or signature scheme in this file is inferred from
 * Safaricom Daraja: Nexus Pay exposes a different API.
 */

export interface NexusPayConfig {
  apiKey: string;
  webhookSecret: string;
  baseUrl: string;
  timeoutMs: number;
}

export interface NexusPayClientOptions {
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export const NEXUS_PAY_DEFAULT_TIMEOUT_MS = 10_000;

export function loadNexusPayConfig(env: NodeJS.ProcessEnv = process.env): NexusPayConfig {
  return {
    apiKey: env.NEXUS_PAY_API_KEY?.trim() ?? '',
    webhookSecret: env.NEXUS_PAY_WEBHOOK_SECRET?.trim() ?? '',
    baseUrl: (env.NEXUS_PAY_API_BASE_URL?.trim() ?? '').replace(/\/+$/, ''),
    timeoutMs: Number(env.NEXUS_PAY_TIMEOUT_MS ?? NEXUS_PAY_DEFAULT_TIMEOUT_MS)
  };
}

export function nexusPayConfigError(config: NexusPayConfig, env: NodeJS.ProcessEnv = process.env): string | null {
  if (!config.apiKey) return 'Set NEXUS_PAY_API_KEY to the secret key from the Nexus Pay dashboard.';
  if (config.apiKey.startsWith('pk_')) {
    return 'NEXUS_PAY_API_KEY must be the secret key (sk_... or sb_...), not the public key (pk_...).';
  }
  if (!config.webhookSecret) return 'Set NEXUS_PAY_WEBHOOK_SECRET from the Nexus Pay Webhooks dashboard.';
  if (!config.baseUrl) return 'Set NEXUS_PAY_API_BASE_URL to the API origin shown in the Nexus Pay dashboard.';
  try {
    const baseUrl = new URL(config.baseUrl);
    if (
      baseUrl.protocol !== 'https:' &&
      (env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname))
    ) {
      return 'NEXUS_PAY_API_BASE_URL must use HTTPS.';
    }
  } catch {
    return 'NEXUS_PAY_API_BASE_URL must be a valid URL.';
  }
  if (!Number.isFinite(config.timeoutMs) || config.timeoutMs <= 0) {
    return 'NEXUS_PAY_TIMEOUT_MS must be a positive number.';
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Parses a decimal KES amount from the provider without accepting loose junk. */
export function parseKesAmount(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value === 'string' && /^\d+(\.\d{1,2})?$/.test(value.trim())) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeStatus(value: unknown): ProviderTransactionStatus {
  const status = stringValue(value)?.toLowerCase();
  if (status === 'pending' || status === 'processing' || status === 'initiated') return 'pending';
  if (status === 'completed' || status === 'successful' || status === 'success' || status === 'paid')
    return 'completed';
  if (status === 'failed') return 'failed';
  if (status === 'cancelled' || status === 'canceled') return 'cancelled';
  return 'unknown';
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const body = (await response.json().catch(() => null)) as unknown;
  return isRecord(body) ? body : {};
}

export function createNexusPayClient(config: NexusPayConfig, options: NexusPayClientOptions = {}): MpesaClient {
  const fetchImpl = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? config.timeoutMs ?? NEXUS_PAY_DEFAULT_TIMEOUT_MS;

  async function request(
    path: string,
    init: RequestInit
  ): Promise<{ response: Response; body: Record<string, unknown> }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(`${config.baseUrl}${path}`, {
        ...init,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-api-key': config.apiKey,
          ...(init.headers ?? {})
        },
        signal: controller.signal
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new MpesaError('Nexus Pay did not respond in time. Please try again.', 'timeout');
      }
      throw new MpesaError(
        error instanceof Error ? `Could not reach Nexus Pay: ${error.message}` : 'Could not reach Nexus Pay.',
        'network_error'
      );
    } finally {
      clearTimeout(timer);
    }
    return { response, body: await readJson(response) };
  }

  function providerError(response: Response, body: Record<string, unknown>): MpesaError {
    const message =
      stringValue(body.message) ??
      stringValue(body.error) ??
      `Nexus Pay rejected the request (HTTP ${response.status}).`;
    return new MpesaError(message, stringValue(body.error) ?? 'nexus_pay_error');
  }

  return {
    mode: 'live',
    provider: 'nexus_pay',
    async stkPush(requestBody: StkPushRequest): Promise<StkPushResult> {
      const { response, body } = await request('/api/payments/stkpush', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber: requestBody.phone,
          amount: requestBody.amountKes,
          accountReference: requestBody.accountReference,
          transactionDesc: requestBody.description
        })
      });
      if (!response.ok) throw providerError(response, body);

      if (body.responseCode !== undefined && String(body.responseCode) !== '0') {
        throw new MpesaError(
          stringValue(body.responseDescription) ?? 'Nexus Pay returned an invalid STK Push response.',
          'stk_invalid'
        );
      }

      const checkoutRequestId = stringValue(body.checkoutRequestId);
      if (!checkoutRequestId) {
        throw new MpesaError('Nexus Pay returned no checkout request id.', 'stk_invalid');
      }

      return {
        checkoutRequestId,
        merchantRequestId: stringValue(body.merchantRequestId),
        customerMessage: stringValue(body.customerMessage),
        transactionId: body.transactionId === undefined ? undefined : String(body.transactionId)
      };
    },
    async stkQuery(checkoutRequestId: string): Promise<StkQueryResult> {
      const { response, body } = await request(`/api/payments/status/${encodeURIComponent(checkoutRequestId)}`, {
        method: 'GET'
      });
      if (!response.ok) throw providerError(response, body);

      const status = normalizeStatus(body.status);
      const resultCode = status === 'completed' ? 0 : status === 'pending' ? 1037 : status === 'unknown' ? -1 : 1032;

      return {
        checkoutRequestId: stringValue(body.checkoutRequestId) ?? checkoutRequestId,
        resultCode,
        resultDesc: stringValue(body.status) ?? 'Nexus Pay returned an unknown status.',
        status,
        transactionId: body.id === undefined || body.id === null ? undefined : String(body.id),
        receipt: stringValue(body.mpesaReceiptNumber),
        amountKes: parseKesAmount(body.amount) ?? undefined,
        phone: normalizeKenyanPhone(body.phoneNumber) ?? undefined
      };
    }
  };
}

/**
 * Verifies the documented `sha256=<hex>` HMAC over the exact raw request body.
 * The caller must read the request body as bytes/text before JSON parsing.
 */
export function verifyNexusPaySignature(
  rawBody: string | Buffer,
  signatureHeader: string | null | undefined,
  webhookSecret: string
): boolean {
  if (!signatureHeader || !webhookSecret) return false;
  const match = /^sha256=([0-9a-f]{64})$/i.exec(signatureHeader.trim());
  if (!match) return false;

  const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  const actual = match[1]!.toLowerCase();
  return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(actual, 'utf8'));
}

export type NexusPayEventType = 'payment.completed' | 'payment.failed' | 'payment.cancelled';

export interface NexusPayWebhookEvent {
  event: NexusPayEventType;
  timestamp?: string;
  data: {
    id: string | null;
    checkoutRequestId: string;
    phoneNumber: string | null;
    amount: number;
    status: string;
    mpesaReceiptNumber: string | null;
    accountReference: string | null;
    createdAt?: string;
  };
}

const NEXUS_PAY_EVENTS: readonly string[] = ['payment.completed', 'payment.failed', 'payment.cancelled'];

/**
 * Validates the documented webhook envelope. Returns null for events this
 * application does not handle or payloads missing required M-Pesa fields.
 */
export function parseNexusPayWebhook(value: unknown): NexusPayWebhookEvent | null {
  if (!isRecord(value)) return null;
  const event = stringValue(value.event);
  if (!event || !NEXUS_PAY_EVENTS.includes(event)) return null;
  if (!isRecord(value.data)) return null;

  const data = value.data;
  const checkoutRequestId = stringValue(data.checkoutRequestId);
  const amount = parseKesAmount(data.amount);
  const status = stringValue(data.status);
  if (!checkoutRequestId || amount === null || !status) return null;

  return {
    event: event as NexusPayEventType,
    timestamp: stringValue(value.timestamp),
    data: {
      id: data.id === undefined || data.id === null ? null : String(data.id),
      checkoutRequestId,
      phoneNumber: stringValue(data.phoneNumber) ?? null,
      amount,
      status,
      mpesaReceiptNumber: stringValue(data.mpesaReceiptNumber) ?? null,
      accountReference: stringValue(data.accountReference) ?? null,
      createdAt: stringValue(data.createdAt)
    }
  };
}

export interface NexusPayPaymentSnapshot {
  id: string;
  provider: string;
  amountKes: number;
  phone: string;
  status: string;
  checkoutRequestId?: string | null;
  providerTransactionId?: string | null;
  accountReference?: string | null;
}

export type NexusPayEventDecision =
  | { action: 'settle'; receipt: string; resultCode: 0 }
  | { action: 'failed'; resultCode: number; reason: string }
  | { action: 'cancelled'; resultCode: number; reason: string }
  | { action: 'ignore'; reason: string };

const RECEIPT_PATTERN = /^[A-Z0-9]{6,20}$/;

/**
 * Decides what a verified webhook may do to a stored payment. This function is
 * deliberately pure and conservative: every identity, amount and status field
 * must agree with what the server recorded before it was sent to the provider.
 */
export function decideNexusPayEvent(
  event: NexusPayWebhookEvent,
  payment: NexusPayPaymentSnapshot
): NexusPayEventDecision {
  if (payment.provider !== 'nexus_pay') return { action: 'ignore', reason: 'provider_mismatch' };

  if (payment.checkoutRequestId && payment.checkoutRequestId !== event.data.checkoutRequestId) {
    return { action: 'ignore', reason: 'checkout_id_mismatch' };
  }
  if (payment.providerTransactionId && event.data.id && payment.providerTransactionId !== event.data.id) {
    return { action: 'ignore', reason: 'transaction_id_mismatch' };
  }
  if (
    payment.accountReference &&
    event.data.accountReference &&
    payment.accountReference !== event.data.accountReference
  ) {
    return { action: 'ignore', reason: 'account_reference_mismatch' };
  }
  if (event.data.phoneNumber) {
    const phone = normalizeKenyanPhone(event.data.phoneNumber);
    if (!phone || phone !== payment.phone) return { action: 'ignore', reason: 'phone_mismatch' };
  }
  if (event.data.amount !== payment.amountKes) {
    return { action: 'ignore', reason: 'amount_mismatch' };
  }

  const terminal = payment.status === 'paid' || payment.status === 'failed' || payment.status === 'cancelled';
  const alreadyPaid = payment.status === 'paid';
  const status = event.data.status.toLowerCase();

  if (event.event === 'payment.completed') {
    if (status !== 'completed') return { action: 'ignore', reason: 'event_status_mismatch' };
    if (alreadyPaid) return { action: 'ignore', reason: 'duplicate' };
    if (terminal) return { action: 'ignore', reason: 'payment_already_final' };
    if (!event.data.mpesaReceiptNumber || !RECEIPT_PATTERN.test(event.data.mpesaReceiptNumber)) {
      return { action: 'ignore', reason: 'missing_receipt' };
    }
    return { action: 'settle', receipt: event.data.mpesaReceiptNumber, resultCode: 0 };
  }

  if (event.event === 'payment.failed') {
    if (status !== 'failed') return { action: 'ignore', reason: 'event_status_mismatch' };
    if (terminal) return { action: 'ignore', reason: alreadyPaid ? 'duplicate' : 'payment_already_final' };
    return { action: 'failed', resultCode: 1032, reason: 'provider_reported_failure' };
  }

  if (status !== 'cancelled') return { action: 'ignore', reason: 'event_status_mismatch' };
  if (terminal) return { action: 'ignore', reason: alreadyPaid ? 'duplicate' : 'payment_already_final' };
  return { action: 'cancelled', resultCode: 1032, reason: 'customer_cancelled' };
}

export type StkQueryDecision =
  | { action: 'settle'; receipt?: string; resultCode: 0 }
  | { action: 'failed'; resultCode: number; reason: string }
  | { action: 'cancelled'; resultCode: number; reason: string }
  | { action: 'wait'; reason: string }
  | { action: 'ignore'; reason: string };

/**
 * Turns an authoritative status-query response into a state transition without
 * trusting a provider's status field over the recorded amount/phone.
 */
export function decideStkQuery(
  result: StkQueryResult,
  payment: Pick<NexusPayPaymentSnapshot, 'amountKes' | 'phone'>
): StkQueryDecision {
  if (result.amountKes !== undefined && result.amountKes !== payment.amountKes) {
    return { action: 'ignore', reason: 'amount_mismatch' };
  }
  if (result.phone && result.phone !== payment.phone) {
    return { action: 'ignore', reason: 'phone_mismatch' };
  }
  if (result.receipt && !RECEIPT_PATTERN.test(result.receipt)) {
    return { action: 'ignore', reason: 'invalid_receipt' };
  }

  if (result.status === 'completed' || result.resultCode === 0) {
    return { action: 'settle', receipt: result.receipt, resultCode: 0 };
  }
  if (result.status === 'pending' || result.resultCode === 1037) {
    return { action: 'wait', reason: 'pending' };
  }
  if (result.status === 'cancelled') {
    return { action: 'cancelled', resultCode: result.resultCode, reason: 'customer_cancelled' };
  }
  if (result.status === 'failed') {
    return { action: 'failed', resultCode: result.resultCode, reason: 'provider_reported_failure' };
  }
  return { action: 'wait', reason: 'unknown_status' };
}
