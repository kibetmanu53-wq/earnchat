import { loadMailConfig, mailConfigError } from '@earnchat/email';
import { loadMpesaConfig, loadPaymentProvider, paymentConfigError } from '@earnchat/payments';
import { jsonOk } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const provider = loadPaymentProvider();
  const mpesa = loadMpesaConfig();
  const mail = loadMailConfig();
  return jsonOk({
    ok: true,
    paymentsConfigured: paymentConfigError() === null,
    paymentProvider: provider,
    paymentMode: provider === 'nexus_pay' ? 'live' : mpesa.mode,
    // Nexus Pay owns its own environment; the value is not meaningful here.
    paymentEnvironment: provider === 'nexus_pay' ? null : mpesa.mode === 'mock' ? 'mock' : mpesa.environment,
    emailConfigured: mailConfigError(mail) === null,
    mailMode: mail.mode,
    withdrawalsEnabled: false
  });
}
