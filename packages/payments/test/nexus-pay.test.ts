import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createNexusPayClient,
  decideNexusPayEvent,
  decideStkQuery,
  getPaymentClient,
  loadNexusPayConfig,
  loadPaymentProvider,
  nexusPayConfigError,
  parseKesAmount,
  parseNexusPayWebhook,
  verifyNexusPaySignature,
  type NexusPayPaymentSnapshot,
  type NexusPayWebhookEvent
} from '../src/index';

const config = {
  apiKey: 'sk_test_secret',
  webhookSecret: 'whsec_test',
  baseUrl: 'https://makamescopay.test',
  timeoutMs: 5000
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

const payment: NexusPayPaymentSnapshot = {
  id: 'payment-1',
  provider: 'nexus_pay',
  amountKes: 150,
  phone: '254712345678',
  status: 'pending',
  checkoutRequestId: 'ws_CO_123',
  providerTransactionId: 'tx_123',
  accountReference: 'ECABCDEF1234'
};

function completedEvent(overrides: Partial<NexusPayWebhookEvent['data']> = {}): NexusPayWebhookEvent {
  return {
    event: 'payment.completed',
    data: {
      id: 'tx_123',
      checkoutRequestId: 'ws_CO_123',
      phoneNumber: '254712345678',
      amount: 150,
      status: 'completed',
      mpesaReceiptNumber: 'QAB123CDEF',
      accountReference: 'ECABCDEF1234',
      ...overrides
    }
  };
}

describe('Nexus Pay config', () => {
  it('defaults to Nexus Pay when PAYMENT_PROVIDER is unset', () => {
    expect(loadPaymentProvider({} as NodeJS.ProcessEnv)).toBe('nexus_pay');
    expect(loadPaymentProvider({ PAYMENT_PROVIDER: 'daraja' } as NodeJS.ProcessEnv)).toBe('daraja');
  });

  it('accepts common Nexus Pay spellings', () => {
    for (const value of ['nexus_pay', 'nexus-pay', 'NEXUS']) {
      expect(loadPaymentProvider({ PAYMENT_PROVIDER: value } as NodeJS.ProcessEnv)).toBe('nexus_pay');
    }
  });

  it('reports each missing setting', () => {
    const missingKey = loadNexusPayConfig({} as NodeJS.ProcessEnv);
    expect(nexusPayConfigError(missingKey)).toMatch(/NEXUS_PAY_API_KEY/);

    const publicKey = { ...config, apiKey: 'pk_public' };
    expect(nexusPayConfigError(publicKey)).toMatch(/secret key/i);

    const missingSecret = { ...config, webhookSecret: '' };
    expect(nexusPayConfigError(missingSecret)).toMatch(/NEXUS_PAY_WEBHOOK_SECRET/);

    const missingBase = { ...config, baseUrl: '' };
    expect(nexusPayConfigError(missingBase)).toMatch(/NEXUS_PAY_API_BASE_URL/);

    const badTimeout = { ...config, timeoutMs: 0 };
    expect(nexusPayConfigError(badTimeout)).toMatch(/NEXUS_PAY_TIMEOUT_MS/);
  });

  it('requires HTTPS except for localhost in development', () => {
    const httpConfig = { ...config, baseUrl: 'http://makamescopay.test' };
    expect(nexusPayConfigError(httpConfig, { NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toMatch(/HTTPS/);
    expect(nexusPayConfigError(httpConfig)).toMatch(/HTTPS/);

    const localhost = { ...config, baseUrl: 'http://localhost:4000' };
    expect(nexusPayConfigError(localhost)).toBeNull();
    expect(nexusPayConfigError(localhost, { NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toMatch(/HTTPS/);
  });

  it('builds a Nexus Pay client only when fully configured', () => {
    const client = getPaymentClient({
      PAYMENT_PROVIDER: 'nexus_pay',
      NEXUS_PAY_API_KEY: config.apiKey,
      NEXUS_PAY_WEBHOOK_SECRET: config.webhookSecret,
      NEXUS_PAY_API_BASE_URL: config.baseUrl
    } as NodeJS.ProcessEnv);
    expect(client.provider).toBe('nexus_pay');
    expect(client.mode).toBe('live');
  });
});

describe('Nexus Pay client', () => {
  it('sends the documented STK Push fields and auth header', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const client = createNexusPayClient(config, {
      fetch: (async (url: string | URL | Request, init?: RequestInit) => {
        requests.push({ url: String(url), init });
        return jsonResponse({
          checkoutRequestId: 'ws_CO_123',
          merchantRequestId: 'mr_1',
          responseCode: '0',
          responseDescription: 'Success',
          customerMessage: 'Enter PIN',
          transactionId: 'tx_123'
        });
      }) as typeof fetch
    });

    const result = await client.stkPush({
      amountKes: 150,
      phone: '254712345678',
      accountReference: 'ECABCDEF1234',
      description: 'EarnChat verification'
    });

    expect(result).toEqual({
      checkoutRequestId: 'ws_CO_123',
      merchantRequestId: 'mr_1',
      customerMessage: 'Enter PIN',
      transactionId: 'tx_123'
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]!.url).toBe('https://makamescopay.test/api/payments/stkpush');
    expect(requests[0]!.init?.method).toBe('POST');
    expect((requests[0]!.init?.headers as Record<string, string>)['x-api-key']).toBe(config.apiKey);
    expect(JSON.parse(String(requests[0]!.init?.body))).toEqual({
      phoneNumber: '254712345678',
      amount: 150,
      accountReference: 'ECABCDEF1234',
      transactionDesc: 'EarnChat verification'
    });
  });

  it('surfaces provider HTTP errors without leaking credentials', async () => {
    const client = createNexusPayClient(config, {
      fetch: (async () => jsonResponse({ error: 'Invalid API key' }, 401)) as typeof fetch
    });
    await expect(
      client.stkPush({
        amountKes: 150,
        phone: '254712345678',
        accountReference: 'ECABCDEF1234',
        description: 'test'
      })
    ).rejects.toThrow('Invalid API key');
  });

  it('rejects a non-zero response code even with HTTP 200', async () => {
    const client = createNexusPayClient(config, {
      fetch: (async () => jsonResponse({ responseCode: '1', responseDescription: 'Rejected' })) as typeof fetch
    });
    await expect(
      client.stkPush({
        amountKes: 150,
        phone: '254712345678',
        accountReference: 'ECABCDEF1234',
        description: 'test'
      })
    ).rejects.toThrow('Rejected');
  });

  it('maps status query responses to result codes and receipt data', async () => {
    const client = createNexusPayClient(config, {
      fetch: (async () =>
        jsonResponse({
          id: 'tx_123',
          checkoutRequestId: 'ws_CO_123',
          status: 'completed',
          mpesaReceiptNumber: 'QAB123CDEF',
          amount: '150.00',
          phoneNumber: '0712345678'
        })) as typeof fetch
    });

    const result = await client.stkQuery('ws_CO_123');
    expect(result).toMatchObject({
      resultCode: 0,
      status: 'completed',
      receipt: 'QAB123CDEF',
      amountKes: 150,
      phone: '254712345678',
      transactionId: 'tx_123'
    });
  });

  it('keeps pending and cancelled statuses distinct', async () => {
    const pending = createNexusPayClient(config, {
      fetch: (async () => jsonResponse({ status: 'pending' })) as typeof fetch
    });
    expect((await pending.stkQuery('ws_CO_123')).resultCode).toBe(1037);

    const cancelled = createNexusPayClient(config, {
      fetch: (async () => jsonResponse({ status: 'cancelled' })) as typeof fetch
    });
    expect(await cancelled.stkQuery('ws_CO_123')).toMatchObject({ status: 'cancelled', resultCode: 1032 });
  });
});

describe('Nexus Pay signature', () => {
  it('accepts the documented sha256=<hex> HMAC over the raw body', () => {
    const body = JSON.stringify({ event: 'payment.completed', data: {} });
    const signature = createHmac('sha256', config.webhookSecret).update(body).digest('hex');
    expect(verifyNexusPaySignature(body, `sha256=${signature}`, config.webhookSecret)).toBe(true);
    expect(verifyNexusPaySignature(Buffer.from(body), `SHA256=${signature}`, config.webhookSecret)).toBe(true);
  });

  it('rejects tampered bodies, wrong secrets, missing values, and malformed headers', () => {
    const body = JSON.stringify({ event: 'payment.completed' });
    const signature = createHmac('sha256', config.webhookSecret).update(body).digest('hex');
    expect(verifyNexusPaySignature(body + ' ', `sha256=${signature}`, config.webhookSecret)).toBe(false);
    expect(verifyNexusPaySignature(body, `sha256=${signature}`, 'other-secret')).toBe(false);
    expect(verifyNexusPaySignature(body, null, config.webhookSecret)).toBe(false);
    expect(verifyNexusPaySignature(body, signature, config.webhookSecret)).toBe(false);
    expect(verifyNexusPaySignature(body, `sha256=${signature.slice(0, 32)}`, config.webhookSecret)).toBe(false);
    expect(verifyNexusPaySignature(body, 'sha256=not-hex', config.webhookSecret)).toBe(false);
    expect(verifyNexusPaySignature(body, `sha256=${signature}`, '')).toBe(false);
  });
});

describe('Nexus Pay webhook parsing', () => {
  it('parses the documented envelope', () => {
    const payload = { ...completedEvent(), data: { ...completedEvent().data, amount: '150.00' } };
    expect(parseNexusPayWebhook(payload)).toMatchObject({
      event: 'payment.completed',
      data: {
        id: 'tx_123',
        checkoutRequestId: 'ws_CO_123',
        amount: 150,
        status: 'completed',
        mpesaReceiptNumber: 'QAB123CDEF',
        accountReference: 'ECABCDEF1234'
      }
    });
  });

  it('ignores unsupported events and incomplete payloads', () => {
    expect(parseNexusPayWebhook({ ...completedEvent(), event: 'payment.created' })).toBeNull();
    expect(parseNexusPayWebhook({ ...completedEvent(), data: { status: 'completed' } })).toBeNull();
    expect(
      parseNexusPayWebhook({ ...completedEvent(), data: { ...completedEvent().data, amount: 'lots' } })
    ).toBeNull();
    expect(parseNexusPayWebhook(null)).toBeNull();
    expect(parseNexusPayWebhook('event')).toBeNull();
  });

  it('parses amounts strictly', () => {
    expect(parseKesAmount(150)).toBe(150);
    expect(parseKesAmount('150.50')).toBe(150.5);
    expect(parseKesAmount('150.505')).toBeNull();
    expect(parseKesAmount('-1')).toBeNull();
    expect(parseKesAmount('1,000')).toBeNull();
    expect(parseKesAmount(Number.NaN)).toBeNull();
  });
});

describe('Nexus Pay webhook decisions', () => {
  it('settles a verified completed event', () => {
    expect(decideNexusPayEvent(completedEvent(), payment)).toEqual({
      action: 'settle',
      receipt: 'QAB123CDEF',
      resultCode: 0
    });
  });

  it('never settles when identity fields disagree', () => {
    expect(decideNexusPayEvent(completedEvent(), { ...payment, provider: 'daraja' })).toMatchObject({
      action: 'ignore',
      reason: 'provider_mismatch'
    });
    expect(decideNexusPayEvent(completedEvent({ checkoutRequestId: 'ws_OTHER' }), payment)).toMatchObject({
      action: 'ignore',
      reason: 'checkout_id_mismatch'
    });
    expect(decideNexusPayEvent(completedEvent({ id: 'tx_OTHER' }), payment)).toMatchObject({
      action: 'ignore',
      reason: 'transaction_id_mismatch'
    });
    expect(decideNexusPayEvent(completedEvent({ accountReference: 'ECOTHER' }), payment)).toMatchObject({
      action: 'ignore',
      reason: 'account_reference_mismatch'
    });
  });

  it('never settles with the wrong amount, phone, or missing receipt', () => {
    expect(decideNexusPayEvent(completedEvent({ amount: 1 }), payment)).toMatchObject({
      action: 'ignore',
      reason: 'amount_mismatch'
    });
    expect(decideNexusPayEvent(completedEvent({ phoneNumber: '254700000000' }), payment)).toMatchObject({
      action: 'ignore',
      reason: 'phone_mismatch'
    });
    expect(decideNexusPayEvent(completedEvent({ phoneNumber: 'not-a-phone' }), payment)).toMatchObject({
      action: 'ignore',
      reason: 'phone_mismatch'
    });
    expect(decideNexusPayEvent(completedEvent({ mpesaReceiptNumber: null }), payment)).toMatchObject({
      action: 'ignore',
      reason: 'missing_receipt'
    });
    expect(decideNexusPayEvent(completedEvent({ mpesaReceiptNumber: 'bad receipt' }), payment)).toMatchObject({
      action: 'ignore',
      reason: 'missing_receipt'
    });
  });

  it('is idempotent for duplicate completed deliveries', () => {
    expect(decideNexusPayEvent(completedEvent(), { ...payment, status: 'paid' })).toMatchObject({
      action: 'ignore',
      reason: 'duplicate'
    });
  });

  it('does not let a late failure or cancellation undo a paid payment', () => {
    const failed: NexusPayWebhookEvent = {
      event: 'payment.failed',
      data: { ...completedEvent().data, status: 'failed' }
    };
    const cancelled: NexusPayWebhookEvent = {
      event: 'payment.cancelled',
      data: { ...completedEvent().data, status: 'cancelled' }
    };
    expect(decideNexusPayEvent(failed, { ...payment, status: 'paid' })).toMatchObject({ action: 'ignore' });
    expect(decideNexusPayEvent(cancelled, { ...payment, status: 'paid' })).toMatchObject({ action: 'ignore' });
  });

  it('records failures and cancellations only from a matching pending payment', () => {
    const failed: NexusPayWebhookEvent = {
      event: 'payment.failed',
      data: { ...completedEvent().data, status: 'failed' }
    };
    const cancelled: NexusPayWebhookEvent = {
      event: 'payment.cancelled',
      data: { ...completedEvent().data, status: 'cancelled' }
    };
    expect(decideNexusPayEvent(failed, payment)).toMatchObject({ action: 'failed', resultCode: 1032 });
    expect(decideNexusPayEvent(cancelled, payment)).toMatchObject({ action: 'cancelled', resultCode: 1032 });
  });

  it('rejects an event whose internal status contradicts its event name', () => {
    expect(decideNexusPayEvent(completedEvent({ status: 'failed' }), payment)).toMatchObject({
      action: 'ignore',
      reason: 'event_status_mismatch'
    });
  });
});

describe('status query decisions', () => {
  it('settles only a matching completed query', () => {
    expect(
      decideStkQuery(
        {
          resultCode: 0,
          resultDesc: 'completed',
          status: 'completed',
          receipt: 'QAB123CDEF',
          amountKes: 150,
          phone: '254712345678'
        },
        payment
      )
    ).toEqual({ action: 'settle', receipt: 'QAB123CDEF', resultCode: 0 });
  });

  it('ignores a query that disagrees with the stored amount, phone, or receipt', () => {
    expect(
      decideStkQuery({ resultCode: 0, resultDesc: 'ok', status: 'completed', amountKes: 1 }, payment)
    ).toMatchObject({ action: 'ignore', reason: 'amount_mismatch' });
    expect(
      decideStkQuery({ resultCode: 0, resultDesc: 'ok', status: 'completed', phone: '254700000000' }, payment)
    ).toMatchObject({ action: 'ignore', reason: 'phone_mismatch' });
    expect(
      decideStkQuery({ resultCode: 0, resultDesc: 'ok', status: 'completed', receipt: 'bad receipt' }, payment)
    ).toMatchObject({ action: 'ignore', reason: 'invalid_receipt' });
  });

  it('waits on pending and unknown statuses', () => {
    expect(decideStkQuery({ resultCode: 1037, resultDesc: 'pending', status: 'pending' }, payment)).toMatchObject({
      action: 'wait'
    });
    expect(decideStkQuery({ resultCode: -1, resultDesc: 'unknown', status: 'unknown' }, payment)).toMatchObject({
      action: 'wait'
    });
  });

  it('maps cancelled and failed queries without granting access', () => {
    expect(decideStkQuery({ resultCode: 1032, resultDesc: 'cancelled', status: 'cancelled' }, payment)).toMatchObject({
      action: 'cancelled'
    });
    expect(decideStkQuery({ resultCode: 1032, resultDesc: 'failed', status: 'failed' }, payment)).toMatchObject({
      action: 'failed'
    });
  });
});
