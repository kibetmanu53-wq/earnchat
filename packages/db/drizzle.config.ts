import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

loadEnv({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });
loadEnv();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Add it to the root .env file.');
}

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL
  },
  verbose: true,
  strict: true
});
