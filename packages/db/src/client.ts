import net from 'node:net';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import * as schema from './schema';

// Some managed Postgres hosts (e.g. Neon) publish IPv6 addresses. On a host
// with no IPv6 route, Node's Happy Eyeballs tries them first and the connection
// stalls instead of failing over. Match the web dev scripts by disabling
// automatic family selection so the first resolved address is used.
if (typeof net.setDefaultAutoSelectFamily === 'function') {
  net.setDefaultAutoSelectFamily(false);
}

let sqlClient: Sql | null = null;
let database: PostgresJsDatabase<typeof schema> | null = null;

export function getSql(): Sql {
  if (!sqlClient) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set. Point it at a PostgreSQL database.');
    sqlClient = postgres(url, { max: 10, onnotice: () => {} });
  }
  return sqlClient;
}

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!database) database = drizzle(getSql(), { schema });
  return database;
}

export type Database = PostgresJsDatabase<typeof schema>;

export { schema };
