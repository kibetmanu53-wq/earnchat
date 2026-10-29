import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { confirmPaymentByQuery, listPendingPayments } from '@earnchat/core';
import { createLogger } from '@earnchat/logger';
import {
  getPaymentClientForProvider,
  isPaymentProvider,
  loadMpesaConfig,
  loadPaymentProvider,
  paymentConfigError,
  type MpesaClient
} from '@earnchat/payments';

const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(rootEnv) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(rootEnv);
}

const log = createLogger({ service: 'worker' });
const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 15_000);
const BATCH_SIZE = 50;

let running = false;
let stopping = false;

async function sweep(): Promise<void> {
  if (running || stopping) return;
  running = true;
  try {
    const pending = await listPendingPayments(BATCH_SIZE);
    if (pending.length === 0) return;
    const clients = new Map<string, MpesaClient>();
    for (const payment of pending) {
      try {
        if (!isPaymentProvider(payment.provider)) {
          log.warn('skipping payment with unknown provider', { paymentId: payment.id, provider: payment.provider });
          continue;
        }
        let mpesa = clients.get(payment.provider);
        if (!mpesa) {
          mpesa = getPaymentClientForProvider(payment.provider);
          clients.set(payment.provider, mpesa);
        }
        const result = await confirmPaymentByQuery(payment.id, mpesa);
        if (result && result.status !== payment.status) {
          log.info('payment status changed', {
            paymentId: payment.id,
            provider: payment.provider,
            from: payment.status,
            to: result.status
          });
        }
      } catch (error) {
        log.warn('could not confirm payment', { paymentId: payment.id, provider: payment.provider, error });
      }
    }
  } catch (error) {
    log.error('sweep failed', { error });
  } finally {
    running = false;
  }
}

async function main(): Promise<void> {
  const provider = loadPaymentProvider();
  const config = loadMpesaConfig();
  log.info('starting', {
    pollIntervalMs: POLL_INTERVAL_MS,
    paymentProvider: provider,
    mpesaMode: provider === 'daraja' ? config.mode : undefined
  });
  const configError = paymentConfigError();
  if (configError) log.warn('payments are not fully configured', { paymentProvider: provider, configError });

  await sweep();

  const timer = setInterval(() => void sweep(), POLL_INTERVAL_MS);

  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    log.info('shutting down', { signal });
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  log.error('fatal', { error });
  process.exit(1);
});
