import { createDarajaClient } from './daraja';
import { createMockMpesaClient } from './mock';
import { MpesaError, type MpesaClient, type MpesaEnvironment, type MpesaMode } from './types';

export * from './types';
export { createDarajaClient, darajaPassword, darajaTimestamp } from './daraja';
export { createMockMpesaClient } from './mock';

export interface MpesaConfig {
  mode: MpesaMode;
  environment: MpesaEnvironment;
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  callbackUrl: string;
}

export function loadMpesaConfig(env: NodeJS.ProcessEnv = process.env): MpesaConfig {
  return {
    mode: env.MPESA_MODE === 'mock' ? 'mock' : 'live',
    environment: env.MPESA_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
    consumerKey: env.MPESA_CONSUMER_KEY?.trim() ?? '',
    consumerSecret: env.MPESA_CONSUMER_SECRET?.trim() ?? '',
    shortcode: env.MPESA_SHORTCODE?.trim() ?? '',
    passkey: env.MPESA_PASSKEY?.trim() ?? '',
    callbackUrl: env.MPESA_CALLBACK_URL?.trim() ?? ''
  };
}

export function mpesaConfigError(config: MpesaConfig, env: NodeJS.ProcessEnv = process.env): string | null {
  if (config.mode === 'mock') {
    if (env.NODE_ENV === 'production') {
      return 'MPESA_MODE=mock is not allowed in production because it grants entitlements without a real payment. Set MPESA_MODE=live.';
    }
    return null;
  }
  if (!config.consumerKey) return 'Set MPESA_CONSUMER_KEY.';
  if (!config.consumerSecret) return 'Set MPESA_CONSUMER_SECRET.';
  if (!config.shortcode || !/^\d+$/.test(config.shortcode)) return 'Set MPESA_SHORTCODE to a numeric Paybill.';
  if (!config.passkey) return 'Set MPESA_PASSKEY.';
  if (!config.callbackUrl) return 'Set MPESA_CALLBACK_URL to the public callback URL.';
  try {
    const callback = new URL(config.callbackUrl);
    if (callback.protocol !== 'https:' && (config.environment === 'production' || !['localhost', '127.0.0.1'].includes(callback.hostname))) {
      return 'MPESA_CALLBACK_URL must use HTTPS.';
    }
  } catch {
    return 'MPESA_CALLBACK_URL must be a valid URL.';
  }
  return null;
}

export function getMpesaClient(config: MpesaConfig = loadMpesaConfig(), env: NodeJS.ProcessEnv = process.env): MpesaClient {
  const error = mpesaConfigError(config, env);
  if (error) throw new MpesaError(`M-Pesa is not configured. ${error}`, 'not_configured');
  if (config.mode === 'mock') return createMockMpesaClient();
  return createDarajaClient(config);
}
