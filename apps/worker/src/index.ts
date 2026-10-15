import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { confirmPaymentByQuery, listPendingPayments } from '@earnchat/core';
import { getMpesaClient, loadMpesaConfig, mpesaConfigError } from '@earnchat/payments';

const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(rootEnv) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(rootEnv);
}

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
          log(`payment ${payment.id} ${payment.status} -> ${result.status}`);
        }
      } catch (error) {
        warn(`could not confirm payment ${payment.id}: ${(error as Error).message}`);
      }
    }
  } catch (error) {
    error2(`sweep failed: ${(error as Error).message}`);
  } finally {
    running = false;
  }
}

function log(message: string) {
  console.log(`[worker ${new Date().toISOString()}] ${message}`);
}
function warn(message: string) {
  console.warn(`[worker ${new Date().toISOString()}] WARN ${message}`);
}
function error2(message: string) {
  console.error(`[worker ${new Date().toISOString()}] ERROR ${message}`);
}

async function main(): Promise<void> {
  const config = loadMpesaConfig();
  log(`starting — interval ${POLL_INTERVAL_MS}ms, M-Pesa mode "${config.mode}"`);
  const configError = mpesaConfigError(config);
  if (configError) warn(`M-Pesa is not fully configured: ${configError}`);

  await sweep();

  const timer = setInterval(() => void sweep(), POLL_INTERVAL_MS);

  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    log(`received ${signal}, shutting down`);
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  error2(`fatal: ${(error as Error).message}`);
  process.exit(1);
});
