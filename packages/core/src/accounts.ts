import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  earningsLedger,
  eligibleChats,
  getDb,
  payments,
  users,
  withdrawalRequests,
  type Database,
  type User
} from '@earnchat/db';
import { hashPassword, verifyPassword } from '@earnchat/auth';
import { computeAvailableToWithdraw } from '@earnchat/domain';
import { AppError } from './errors';
import { listUserPayments, PAYMENT_HISTORY_PAGE_SIZE, type PaymentSummary } from './payments';

export interface CreateAccountInput {
  email: string;
  displayName: string;
  password: string;
}

export async function createAccount(input: CreateAccountInput, db: Database = getDb()): Promise<User> {
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
  if (existing.length > 0) throw new AppError('An account with that email already exists.', 409, 'email_taken');
  const passwordHash = await hashPassword(input.password);
  const [user] = await db
    .insert(users)
    .values({ email: input.email, displayName: input.displayName, passwordHash })
    .returning();
  if (!user) throw new AppError('Could not create the account.', 500);
  return user;
}

export async function authenticate(email: string, password: string, db: Database = getDb()): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) return null;
  const valid = await verifyPassword(password, user.passwordHash);
  return valid ? user : null;
}

export async function getUserById(userId: string, db: Database = getDb()): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
}

export interface DashboardUser {
  id: string;
  email: string;
  displayName: string;
  verified: boolean;
  membershipPlan: User['membershipPlan'];
  earningsBalanceKes: number;
  availableToWithdrawKes: number;
  paidFeesKes: number;
  paidFeesByKind: Record<string, number>;
  membershipFeesKes: number;
  eligibleChats: Array<{ chatReference: string; completedMinutes: number; amountKes: number; createdAt: Date }>;
  recentPayments: PaymentSummary[];
  recentPaymentsNextCursor: string | null;
}

const RESERVED_WITHDRAWAL_STATUSES = ['fee_pending', 'fee_paid_pending_payout', 'payout_pending'] as const;

export async function getDashboard(user: User, db: Database = getDb()): Promise<DashboardUser> {
  const [earningsRow] = await db
    .select({ total: sql<string>`coalesce(sum(${earningsLedger.amountKes}), 0)` })
    .from(earningsLedger)
    .where(eq(earningsLedger.userId, user.id));

  const [reservedRow] = await db
    .select({ total: sql<string>`coalesce(sum(${withdrawalRequests.amountKes}), 0)` })
    .from(withdrawalRequests)
    .where(and(eq(withdrawalRequests.userId, user.id), inArray(withdrawalRequests.status, [...RESERVED_WITHDRAWAL_STATUSES])));

  const feeRows = await db
    .select({ type: payments.type, total: sql<string>`coalesce(sum(${payments.amountKes}), 0)` })
    .from(payments)
    .where(and(eq(payments.userId, user.id), eq(payments.status, 'paid')))
    .groupBy(payments.type);

  const { items: recentPayments, nextCursor: recentPaymentsNextCursor } = await listUserPayments(
    user.id,
    { limit: PAYMENT_HISTORY_PAGE_SIZE },
    db
  );

  const chats = await db
    .select({
      chatReference: eligibleChats.chatReference,
      completedMinutes: eligibleChats.completedMinutes,
      amountKes: eligibleChats.amountKes,
      createdAt: eligibleChats.createdAt
    })
    .from(eligibleChats)
    .where(eq(eligibleChats.userId, user.id))
    .orderBy(desc(eligibleChats.createdAt))
    .limit(20);

  const earnings = Number(earningsRow?.total ?? 0);
  const reserved = Number(reservedRow?.total ?? 0);
  const paidFeesByKind = Object.fromEntries(feeRows.map((row) => [row.type, Number(row.total)]));
  const membershipFeesKes = Number(paidFeesByKind.beginner_membership ?? 0);
  const paidFeesKes = Object.values(paidFeesByKind).reduce((sum, value) => sum + value, 0);

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    verified: user.verified,
    membershipPlan: user.membershipPlan,
    earningsBalanceKes: earnings,
    availableToWithdrawKes: computeAvailableToWithdraw(earnings, reserved),
    paidFeesKes,
    paidFeesByKind,
    membershipFeesKes,
    eligibleChats: chats,
    recentPayments,
    recentPaymentsNextCursor
  };
}

export async function updateProfile(
  userId: string,
  input: { displayName: string; age?: number; location?: string; bio?: string; interests?: string },
  db: Database = getDb()
): Promise<User> {
  const [user] = await db
    .update(users)
    .set({
      displayName: input.displayName,
      age: input.age ?? null,
      location: input.location ?? null,
      bio: input.bio ?? null,
      interests: input.interests ?? null,
      updatedAt: new Date()
    })
    .where(eq(users.id, userId))
    .returning();
  if (!user) throw new AppError('Account not found.', 404);
  return user;
}

export async function setMembershipPlan(userId: string, plan: 'advanced' | 'premium', db: Database = getDb()): Promise<User> {
  const user = await getUserById(userId, db);
  if (!user) throw new AppError('Sign in is required.', 401);
  if (!user.verified) throw new AppError('Verify your account before choosing a membership plan.', 403);
  if (user.membershipPlan === 'beginner') {
    throw new AppError('A paid Beginner membership is active and cannot be replaced.', 409);
  }
  const [updated] = await db
    .update(users)
    .set({ membershipPlan: plan, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  if (!updated) throw new AppError('Account not found.', 404);
  return updated;
}
