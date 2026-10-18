import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { confirmPaymentByQuery, listPendingPayments } from '@earnchat/core';
import { createLogger } from '@earnchat/logger';
import { getMpesaClient, loadMpesaConfig, mpesaConfigError } from '@earnchat/payments';

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
    const mpesa = getMpesaClient();
    for (const payment of pending) {
      try {
        const result = await confirmPaymentByQuery(payment.id, mpesa);
        if (result && result.status !== payment.status) {
          log.info('payment status changed', { paymentId: payment.id, from: payment.status, to: result.status });
        }
      } catch (error) {
        log.warn('could not confirm payment', { paymentId: payment.id, error });
      }
    }
  } catch (error) {
    log.error('sweep failed', { error });
  } finally {
    running = false;
  }
}

async function main(): Promise<void> {
  const config = loadMpesaConfig();
  log.info('starting', { pollIntervalMs: POLL_INTERVAL_MS, mpesaMode: config.mode });
  const configError = mpesaConfigError(config);
  if (configError) log.warn('M-Pesa is not fully configured', { configError });

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
