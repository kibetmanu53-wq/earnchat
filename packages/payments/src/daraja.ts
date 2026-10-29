import {
  MpesaError,
  type MpesaClient,
  type MpesaEnvironment,
  type StkPushRequest,
  type StkPushResult,
  type StkQueryResult
} from './types';

export interface DarajaConfig {
  environment: MpesaEnvironment;
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  callbackUrl: string;
}

interface DarajaStkResponse {
  ResponseCode?: string;
  ResponseDescription?: string;
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  CustomerMessage?: string;
  errorMessage?: string;
  errorCode?: string;
}

interface DarajaQueryResponse {
  ResponseCode?: string;
  ResponseDescription?: string;
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  ResultCode?: string;
  ResultDesc?: string;
  errorMessage?: string;
}

/** Builds the Daraja `Timestamp` in Africa/Nairobi as YYYYMMDDHHmmss. */
export function darajaTimestamp(date = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Nairobi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    })
      .formatToParts(date)
      .map(({ type, value }) => [type, value])
  );
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
}

/** Daraja STK password = base64(shortcode + passkey + timestamp). */
export function darajaPassword(shortcode: string, passkey: string, timestamp: string): string {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
}

export function createDarajaClient(config: DarajaConfig): MpesaClient {
  const baseUrl = config.environment === 'sandbox' ? 'https://sandbox.safaricom.co.ke' : 'https://api.safaricom.co.ke';

  let accessToken: string | null = null;
  let accessTokenExpiresAt = 0;

  async function getAccessToken(): Promise<string> {
    if (accessToken && Date.now() < accessTokenExpiresAt) return accessToken;
    const credentials = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
    const response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { authorization: `Basic ${credentials}` }
    });
    const body = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: string;
      errorMessage?: string;
    };
    if (!response.ok || typeof body.access_token !== 'string' || !body.access_token) {
      throw new MpesaError(body.errorMessage || 'Safaricom could not authorize the payment request.', 'oauth_failed');
    }
    accessToken = body.access_token;
    accessTokenExpiresAt = Date.now() + Math.max(0, Number(body.expires_in ?? 0) - 30) * 1000;
    return accessToken;
  }

  async function post<T>(endpoint: string, payload: unknown): Promise<T> {
    const token = await getAccessToken();
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = (await response.json().catch(() => ({}))) as T & { errorMessage?: string; errorCode?: string };
    if (!response.ok) {
      throw new MpesaError(body.errorMessage || 'Safaricom could not complete the M-Pesa request.', body.errorCode);
    }
    return body;
  }

  return {
    mode: 'live',
    provider: 'daraja',
    async stkPush(request: StkPushRequest): Promise<StkPushResult> {
      const timestamp = darajaTimestamp();
      const result = await post<DarajaStkResponse>('/mpesa/stkpush/v1/processrequest', {
        BusinessShortCode: config.shortcode,
        Password: darajaPassword(config.shortcode, config.passkey, timestamp),
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: request.amountKes,
        PartyA: request.phone,
        PartyB: config.shortcode,
        PhoneNumber: request.phone,
        CallBackURL: config.callbackUrl,
        AccountReference: request.accountReference,
        TransactionDesc: request.description
      });
      if (
        String(result.ResponseCode) !== '0' ||
        typeof result.CheckoutRequestID !== 'string' ||
        !result.CheckoutRequestID ||
        typeof result.MerchantRequestID !== 'string' ||
        !result.MerchantRequestID
      ) {
        throw new MpesaError(
          result.ResponseDescription || 'Safaricom returned an invalid STK Push response.',
          'stk_invalid'
        );
      }
      return {
        checkoutRequestId: result.CheckoutRequestID,
        merchantRequestId: result.MerchantRequestID,
        customerMessage: result.CustomerMessage
      };
    },
    async stkQuery(checkoutRequestId: string): Promise<StkQueryResult> {
      const timestamp = darajaTimestamp();
      const result = await post<DarajaQueryResponse>('/mpesa/stkpushquery/v1/query', {
        BusinessShortCode: config.shortcode,
        Password: darajaPassword(config.shortcode, config.passkey, timestamp),
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId
      });
      return {
        checkoutRequestId: result.CheckoutRequestID ?? checkoutRequestId,
        resultCode: Number(result.ResultCode ?? -1),
        resultDesc: result.ResultDesc || result.ResponseDescription || ''
      };
    }
  };
}
