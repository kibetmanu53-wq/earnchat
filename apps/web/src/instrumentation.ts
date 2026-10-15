export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { loadRootEnv } = await import('./instrumentation-node');
    await loadRootEnv();
  }
}
