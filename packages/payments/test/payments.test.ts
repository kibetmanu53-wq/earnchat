import { describe, expect, it } from 'vitest';
import { darajaPassword, darajaTimestamp, createMockMpesaClient, getMpesaClient, loadMpesaConfig, mpesaConfigError } from '../src/index';

describe('daraja helpers', () => {
  it('builds an Africa/Nairobi timestamp of the right shape', () => {
    const timestamp = darajaTimestamp(new Date('2026-01-02T09:08:07Z'));
    expect(timestamp).toMatch(/^\d{14}$/);
  });

  it('builds the base64 password from shortcode + passkey + timestamp', () => {
    const password = darajaPassword('174379', 'passkey', '20260102090807');
    expect(Buffer.from(password, 'base64').toString()).toBe('174379passkey20260102090807');
  });
});

describe('config', () => {
  it('treats mock mode as configured', () => {
    const config = loadMpesaConfig({ MPESA_MODE: 'mock' } as NodeJS.ProcessEnv);
    expect(config.mode).toBe('mock');
    expect(mpesaConfigError(config)).toBeNull();
  });

  it('rejects mock mode in production so entitlements always require a real payment', () => {
    const config = loadMpesaConfig({ MPESA_MODE: 'mock' } as NodeJS.ProcessEnv);
    expect(mpesaConfigError(config, { NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toMatch(/mock is not allowed in production/i);
  });

  it('refuses to build a client when mock mode is used in production', () => {
    const config = loadMpesaConfig({ MPESA_MODE: 'mock' } as NodeJS.ProcessEnv);
    expect(() => getMpesaClient(config, { NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toThrow(
      /mock is not allowed in production/i
    );
  });

  it('flags missing live credentials', () => {
    const config = loadMpesaConfig({ MPESA_MODE: 'live' } as NodeJS.ProcessEnv);
    expect(mpesaConfigError(config)).toMatch(/MPESA_CONSUMER_KEY/);
  });
});

describe('mock client', () => {
  it('succeeds on the first query by default', async () => {
    const client = createMockMpesaClient();
    const push = await client.stkPush({
      amountKes: 150,
      phone: '254712345678',
      accountReference: 'EARNCHAT',
      description: 'test'
    });
    const query = await client.stkQuery(push.checkoutRequestId);
    expect(query.resultCode).toBe(0);
  });

  it('succeeds when the confirmation delay is zero', async () => {
    const client = createMockMpesaClient({ confirmAfterMs: 0 });
    const push = await client.stkPush({
      amountKes: 150,
      phone: '254712345678',
      accountReference: 'EARNCHAT',
      description: 'test'
    });
    const query = await client.stkQuery(push.checkoutRequestId);
    expect(query.resultCode).toBe(0);
  });

  it('confirms a checkout created by a different client instance (web -> worker)', async () => {
    const webClient = createMockMpesaClient();
    const workerClient = createMockMpesaClient({ confirmAfterMs: 0 });
    const push = await webClient.stkPush({
      amountKes: 150,
      phone: '254712345678',
      accountReference: 'EARNCHAT',
      description: 'test'
    });
    const query = await workerClient.stkQuery(push.checkoutRequestId);
    expect(query.resultCode).toBe(0);
  });

  it('stays in progress before the confirm delay across processes', async () => {
    const webClient = createMockMpesaClient();
    const workerClient = createMockMpesaClient({ confirmAfterMs: 60_000 });
    const push = await webClient.stkPush({
      amountKes: 150,
      phone: '254712345678',
      accountReference: 'EARNCHAT',
      description: 'test'
    });
    const query = await workerClient.stkQuery(push.checkoutRequestId);
    expect(query.resultCode).toBe(1037);
  });
});
