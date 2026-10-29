export type MpesaMode = 'mock' | 'live';
export type MpesaEnvironment = 'sandbox' | 'production';

/**
 * The provider that actually moves the money. Kept on the payment record so a
 * webhook or reconciliation query can never be applied to another provider's
 * transaction.
 */
export type PaymentProvider = 'daraja' | 'nexus_pay';

export function isPaymentProvider(value: unknown): value is PaymentProvider {
  return value === 'daraja' || value === 'nexus_pay';
}

export type ProviderTransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled' | 'unknown';

export interface StkPushRequest {
  amountKes: number;
  /** Normalized 2547XXXXXXXX / 2541XXXXXXXX phone number. */
  phone: string;
  accountReference: string;
  description: string;
}

export interface StkPushResult {
  checkoutRequestId: string;
  merchantRequestId?: string;
  customerMessage?: string;
  /** Provider-side transaction id, when the provider exposes one alongside the checkout id. */
  transactionId?: string;
}

export interface StkQueryResult {
  checkoutRequestId?: string;
  resultCode: number;
  resultDesc: string;
  /** Normalized provider status, when the provider exposes one. */
  status?: ProviderTransactionStatus;
  /** Provider-side transaction id, when the provider exposes one. */
  transactionId?: string;
  /** M-Pesa receipt number, when the provider exposes one. */
  receipt?: string;
  /** Amount reported by the provider. Callers must compare it with the stored amount. */
  amountKes?: number;
  /** Payer phone reported by the provider, normalized to 254XXXXXXXXX. */
  phone?: string;
}

export interface MpesaClient {
  readonly mode: MpesaMode;
  readonly provider: PaymentProvider;
  stkPush(request: StkPushRequest): Promise<StkPushResult>;
  stkQuery(checkoutRequestId: string): Promise<StkQueryResult>;
}

export class MpesaError extends Error {
  readonly code: string;
  constructor(message: string, code = 'mpesa_error') {
    super(message);
    this.name = 'MpesaError';
    this.code = code;
  }
}
