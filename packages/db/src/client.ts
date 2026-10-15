import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import * as schema from './schema';

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
