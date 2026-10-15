import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { getDb, sessions, users, type Database, type User } from '@earnchat/db';

export const SESSION_COOKIE = 'earnchat_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

export async function createSession(userId: string, db: Database = getDb()): Promise<CreatedSession> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function getSessionUser(token: string | null | undefined, db?: Database): Promise<User | null> {
  if (!token) return null;
  const database = db ?? getDb();
  const rows = await database
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0]?.user ?? null;
}

export async function destroySession(token: string | null | undefined, db?: Database): Promise<void> {
  if (!token) return;
  const database = db ?? getDb();
  await database.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}
