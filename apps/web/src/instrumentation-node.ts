export async function loadRootEnv() {
  if (typeof process.loadEnvFile !== 'function') return;
  try {
    process.loadEnvFile(new URL('../../../.env', import.meta.url));
  } catch {
    return;
  }
}
