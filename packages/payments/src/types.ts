export type MpesaMode = 'mock' | 'live';
export type MpesaEnvironment = 'sandbox' | 'production';

export interface StkPushRequest {
  amountKes: number;
  /** Normalized 2547XXXXXXXX / 2541XXXXXXXX phone number. */
  phone: string;
  accountReference: string;
  description: string;
}

export interface StkPushResult {
  checkoutRequestId: string;
  merchantRequestId: string;
  customerMessage?: string;
}

export interface StkQueryResult {
  checkoutRequestId?: string;
  resultCode: number;
  resultDesc: string;
}

export interface MpesaClient {
  readonly mode: MpesaMode;
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
