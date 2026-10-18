import { loadMailConfig, mailConfigError } from '@earnchat/email';
import { loadMpesaConfig, mpesaConfigError } from '@earnchat/payments';
import { jsonOk } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const config = loadMpesaConfig();
  const mail = loadMailConfig();
  return jsonOk({
    ok: true,
    paymentsConfigured: mpesaConfigError(config) === null,
    paymentProvider: 'safaricom_mpesa',
    paymentMode: config.mode,
    paymentEnvironment: config.mode === 'mock' ? 'mock' : config.environment,
    emailConfigured: mailConfigError(mail) === null,
    mailMode: mail.mode,
    withdrawalsEnabled: false
  });
}
