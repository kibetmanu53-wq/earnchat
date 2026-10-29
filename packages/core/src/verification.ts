import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { authTokens, getDb, users, type Database } from '@earnchat/db';
import { destroyAllSessions, hashPassword } from '@earnchat/auth';
import { loadMailConfig, passwordResetEmail, sendEmail } from '@earnchat/email';
import { AppError } from './errors';

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

type AuthTokenType = 'reset_password';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Issues a single-use token, replacing any outstanding token of the same type
 * for that user so old links stop working.
 */
async function issueToken(userId: string, type: AuthTokenType, ttlMs: number, db: Database): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await db.transaction(async (tx) => {
    await tx.delete(authTokens).where(and(eq(authTokens.userId, userId), eq(authTokens.type, type)));
    await tx.insert(authTokens).values({
      userId,
      type,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + ttlMs)
    });
  });
  return token;
}

async function findLiveToken(token: string, type: AuthTokenType, db: Database) {
  const [row] = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, hashToken(token)), eq(authTokens.type, type)))
    .limit(1);
  if (!row || row.consumedAt || row.expiresAt.getTime() <= Date.now()) return null;
  return row;
}

function link(path: string, token: string): string {
  const { appUrl } = loadMailConfig();
  return `${appUrl}${path}?token=${encodeURIComponent(token)}`;
}

/** Always resolves, even for unknown emails, to avoid account enumeration. */
export async function requestPasswordReset(email: string, db: Database = getDb()): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) return;
  const token = await issueToken(user.id, 'reset_password', PASSWORD_RESET_TTL_MS, db);
  const message = passwordResetEmail({ displayName: user.displayName, url: link('/reset-password', token) });
  await sendEmail({ to: user.email, ...message });
}

export async function resetPassword(token: string, password: string, db: Database = getDb()): Promise<void> {
  const row = await findLiveToken(token, 'reset_password', db);
  if (!row) throw new AppError('This reset link is invalid or has expired.', 400, 'invalid_token');

  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    const [consumed] = await tx
      .update(authTokens)
      .set({ consumedAt: new Date() })
      .where(and(eq(authTokens.id, row.id), isNull(authTokens.consumedAt)))
      .returning({ id: authTokens.id });
    if (!consumed) throw new AppError('This reset link is invalid or has expired.', 400, 'invalid_token');

    const [updated] = await tx
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, row.userId))
      .returning({ id: users.id });
    if (!updated) throw new AppError('Account not found.', 404);
  });

  // Force re-authentication everywhere after a password change.
  await destroyAllSessions(row.userId, db);
}
