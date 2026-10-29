import { randomUUID } from 'node:crypto';
import { MpesaError, type MpesaClient, type StkPushRequest } from './types';

export interface MockMpesaOptions {
  /** How long a mock checkout stays "in progress" before succeeding. */
  confirmAfterMs?: number;
  /** Force every checkout to fail (cancelled by user). */
  fail?: boolean;
}

const MOCK_ID_PREFIX = 'ws_CO_mock_';

/**
 * In-memory Daraja simulator. Lets the whole payment flow run end-to-end
 * (STK push -> poll -> settle) without real credentials or Safaricom calls.
 *
 * The checkout's creation time is encoded into the checkoutRequestId so that
 * stkQuery is stateless: the web process can create a checkout and the worker
 * process can confirm it without sharing memory.
 */
export function createMockMpesaClient(options: MockMpesaOptions = {}): MpesaClient {
  const confirmAfterMs = options.confirmAfterMs ?? 0;

  return {
    mode: 'mock',
    provider: 'daraja',
    async stkPush(_request: StkPushRequest) {
      const checkoutRequestId = `${MOCK_ID_PREFIX}${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
      return {
        checkoutRequestId,
        merchantRequestId: `mock_${randomUUID()}`,
        customerMessage: 'Mock STK push sent. Complete it in the simulated prompt.'
      };
    },
    async stkQuery(checkoutRequestId) {
      const match = new RegExp(`^${MOCK_ID_PREFIX}(\\d+)_`).exec(checkoutRequestId);
      if (!match) throw new MpesaError('Mock payment not found.', 'stk_not_found');
      const createdAt = Number(match[1]);
      if (Date.now() - createdAt < confirmAfterMs) {
        return { checkoutRequestId, resultCode: 1037, resultDesc: 'The user is currently in the process.' };
      }
      if (options.fail) {
        return { checkoutRequestId, resultCode: 1032, resultDesc: 'Request cancelled by user.' };
      }
      return { checkoutRequestId, resultCode: 0, resultDesc: 'The service request is processed successfully.' };
    }
  };
}
