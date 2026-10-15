import { desc, eq } from 'drizzle-orm';
import { getDb, users, withdrawalRequests, type Database } from '@earnchat/db';
import { MINIMUM_WITHDRAWAL_KES } from '@earnchat/domain';
import { AppError } from './errors';
import { getDashboard } from './accounts';

export interface WithdrawalSummary {
  id: string;
  amountKes: number;
  status: string;
  createdAt: Date;
}

export async function listWithdrawals(userId: string, db: Database = getDb()): Promise<WithdrawalSummary[]> {
  return db
    .select({ id: withdrawalRequests.id, amountKes: withdrawalRequests.amountKes, status: withdrawalRequests.status, createdAt: withdrawalRequests.createdAt })
    .from(withdrawalRequests)
    .where(eq(withdrawalRequests.userId, userId))
    .orderBy(desc(withdrawalRequests.createdAt))
    .limit(20);
}

/**
 * Withdrawals stay disabled until an authorized M-Pesa B2C payout integration
 * is configured. Validation still runs so clients get precise feedback.
 */
export async function requestWithdrawal(
  input: { userId: string; amountKes: number; phone?: string },
  db: Database = getDb()
): Promise<never> {
  const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!user) throw new AppError('Sign in is required.', 401);
  if (!user.verified) throw new AppError('Verify your account before requesting a withdrawal.', 403);
  if (!Number.isSafeInteger(input.amountKes) || input.amountKes < MINIMUM_WITHDRAWAL_KES) {
    throw new AppError(`The minimum withdrawal is KSh ${MINIMUM_WITHDRAWAL_KES}.`, 400);
  }
  const dashboard = await getDashboard(user, db);
  if (input.amountKes > dashboard.availableToWithdrawKes) {
    throw new AppError('Withdrawal amount exceeds your available eligible earnings.', 400);
  }
  throw new AppError(
    'Withdrawals are unavailable until an authorized payout service is configured. No fee has been charged.',
    503,
    'withdrawals_disabled'
  );
}
