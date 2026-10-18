import { and, asc, desc, eq, gt, inArray, isNotNull, lt, or, sql } from 'drizzle-orm';
import { getDb, payments, users, type Database, type Payment } from '@earnchat/db';
import { ACCOUNT_REFERENCE, FEE_AMOUNTS_KES, normalizeKenyanPhone } from '@earnchat/domain';
import type { MpesaClient } from '@earnchat/payments';
import { AppError } from './errors';

const PENDING_STATUSES = ['initiating', 'pending'] as const;
const PENDING_TTL_MS = Number(process.env.PAYMENT_PENDING_TTL_MS ?? 180_000);
const RECEIPT_PATTERN = /^[A-Z0-9]{6,20}$/;

export const PAYMENT_HISTORY_PAGE_SIZE = 5;
export const MAX_PAYMENT_HISTORY_PAGE_SIZE = 50;

export interface PaymentSummary {
  id: string;
  type: Payment['type'];
  amountKes: number;
  status: Payment['status'];
  providerReference: string | null;
  createdAt: Date;
}

export interface PaymentPage {
  items: PaymentSummary[];
  nextCursor: string | null;
}

function encodePaymentCursor(payment: Pick<PaymentSummary, 'id' | 'createdAt'>): string {
  return Buffer.from(`${payment.createdAt.toISOString()}|${payment.id}`).toString('base64url');
}

function decodePaymentCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
    const createdAt = new Date(iso ?? '');
    if (!iso || !id || Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

export type StartupPaymentType = 'verification' | 'beginner_membership';

export interface StartPaymentInput {
  userId: string;
  type: StartupPaymentType;
  phone: unknown;
  mpesa: MpesaClient;
}

export async function startPayment(input: StartPaymentInput, db: Database = getDb()): Promise<Payment> {
  const amountKes = FEE_AMOUNTS_KES[input.type];
  if (!amountKes) throw new AppError('Choose a valid payment type.', 400, 'invalid_type');

  const phone = normalizeKenyanPhone(input.phone);
  if (!phone) throw new AppError('Enter a valid Kenyan M-Pesa phone number, such as 0712345678.', 400, 'invalid_phone');

  const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!user) throw new AppError('Sign in is required.', 401);
  if (input.type === 'verification' && !user.emailVerifiedAt) {
    throw new AppError('Verify your email address before activating your account.', 403, 'email_not_verified');
  }
  if (input.type === 'verification' && user.verified) throw new AppError('This account is already verified.', 409);
  if (input.type === 'beginner_membership' && !user.verified) {
    throw new AppError('Verify your account before purchasing a membership.', 403);
  }
  if (input.type === 'beginner_membership' && user.membershipPlan) {
    throw new AppError('A membership plan is already active.', 409);
  }

  const payment = await db.transaction(async (tx) => {
    // Serialize initiation per (user, type): the lock makes the pending check
    // and insert atomic, so two concurrent requests can't both send an STK push.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.userId}), hashtext(${input.type}))`);

    const [pending] = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.userId, input.userId),
          eq(payments.type, input.type),
          inArray(payments.status, [...PENDING_STATUSES]),
          gt(payments.createdAt, new Date(Date.now() - PENDING_TTL_MS))
        )
      )
      .limit(1);
    if (pending) {
      throw new AppError('A payment is already pending. Complete the M-Pesa prompt or wait for its confirmation.', 409);
    }

    const [created] = await tx
      .insert(payments)
      .values({ userId: input.userId, type: input.type, amountKes, phone, status: 'initiating' })
      .returning();
    if (!created) throw new AppError('Could not create the payment.', 500);
    return created;
  });

  try {
    const result = await input.mpesa.stkPush({
      amountKes,
      phone,
      accountReference: ACCOUNT_REFERENCE,
      description: `EC${payment.id.replaceAll('-', '').slice(0, 10)}`
    });
    const [updated] = await db
      .update(payments)
      .set({
        status: 'pending',
        checkoutRequestId: result.checkoutRequestId,
        merchantRequestId: result.merchantRequestId,
        updatedAt: new Date()
      })
      .where(eq(payments.id, payment.id))
      .returning();
    return updated ?? payment;
  } catch (error) {
    await db
      .update(payments)
      .set({ status: 'initiation_failed', updatedAt: new Date() })
      .where(eq(payments.id, payment.id));
    throw error;
  }
}

export interface SettleInput {
  receipt?: string | null;
  resultCode?: number | null;
}

/** Idempotently marks a payment paid and activates the account entitlement. */
export async function settlePayment(paymentId: string, input: SettleInput, db: Database = getDb()): Promise<Payment | null> {
  return db.transaction(async (tx) => {
    const [payment] = await tx.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!payment) return null;
    if (payment.status === 'paid') return payment;
    if (!(PENDING_STATUSES as readonly string[]).includes(payment.status)) return payment;

    const [updated] = await tx
      .update(payments)
      .set({
        status: 'paid',
        providerReference: input.receipt ?? payment.providerReference,
        resultCode: input.resultCode ?? 0,
        updatedAt: new Date()
      })
      .where(and(eq(payments.id, paymentId), inArray(payments.status, [...PENDING_STATUSES])))
      .returning();

    if (updated) {
      if (payment.type === 'verification') {
        await tx.update(users).set({ verified: true, updatedAt: new Date() }).where(eq(users.id, payment.userId));
      }
      if (payment.type === 'beginner_membership') {
        await tx.update(users).set({ membershipPlan: 'beginner', updatedAt: new Date() }).where(eq(users.id, payment.userId));
      }
    }
    return updated ?? payment;
  });
}

async function markFailed(payment: Payment, resultCode: number, db: Database): Promise<Payment> {
  const [failed] = await db
    .update(payments)
    .set({ status: 'failed', resultCode, updatedAt: new Date() })
    .where(and(eq(payments.id, payment.id), inArray(payments.status, [...PENDING_STATUSES])))
    .returning();
  return failed ?? payment;
}

/** Queries Daraja for the authoritative state of a pending payment. */
export async function confirmPaymentByQuery(paymentId: string, mpesa: MpesaClient, db: Database = getDb()): Promise<Payment | null> {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment || !payment.checkoutRequestId) return payment ?? null;
  if (payment.status === 'paid' || !(PENDING_STATUSES as readonly string[]).includes(payment.status)) return payment;

  const result = await mpesa.stkQuery(payment.checkoutRequestId);
  if (result.resultCode === 0) return settlePayment(payment.id, { resultCode: 0 }, db);
  if (result.resultCode === 1037) return payment;
  return markFailed(payment, result.resultCode, db);
}

export async function listPendingPayments(limit = 50, db: Database = getDb()): Promise<Payment[]> {
  return db
    .select()
    .from(payments)
    .where(and(inArray(payments.status, [...PENDING_STATUSES]), isNotNull(payments.checkoutRequestId)))
    .orderBy(asc(payments.createdAt))
    .limit(limit);
}

export interface ListUserPaymentsOptions {
  limit?: number;
  cursor?: string | null;
}

/**
 * Returns a page of a user's payment history, newest first. Uses a keyset
 * cursor (createdAt + id) so records inserted between pages never duplicate or
 * skip entries the way offset pagination would.
 */
export async function listUserPayments(
  userId: string,
  options: ListUserPaymentsOptions = {},
  db: Database = getDb()
): Promise<PaymentPage> {
  const limit = Math.min(Math.max(options.limit ?? PAYMENT_HISTORY_PAGE_SIZE, 1), MAX_PAYMENT_HISTORY_PAGE_SIZE);
  const cursor = options.cursor ? decodePaymentCursor(options.cursor) : null;
  if (options.cursor && !cursor) throw new AppError('Invalid pagination cursor.', 400, 'invalid_cursor');

  const rows = await db
    .select({
      id: payments.id,
      type: payments.type,
      amountKes: payments.amountKes,
      status: payments.status,
      providerReference: payments.providerReference,
      createdAt: payments.createdAt
    })
    .from(payments)
    .where(
      and(
        eq(payments.userId, userId),
        cursor
          ? or(
              lt(payments.createdAt, cursor.createdAt),
              and(eq(payments.createdAt, cursor.createdAt), lt(payments.id, cursor.id))
            )
          : undefined
      )
    )
    .orderBy(desc(payments.createdAt), desc(payments.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return { items, nextCursor: hasMore && last ? encodePaymentCursor(last) : null };
}

export async function getPayment(paymentId: string, db: Database = getDb()): Promise<Payment | null> {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  return payment ?? null;
}

interface StkCallback {
  CheckoutRequestID?: string;
  MerchantRequestID?: string;
  ResultCode?: number | string;
  CallbackMetadata?: { Item?: Array<{ Name?: string; Value?: unknown }> };
}

function extractMetadata(callback: StkCallback): Record<string, unknown> {
  const items = callback.CallbackMetadata?.Item;
  if (!Array.isArray(items)) return {};
  return Object.fromEntries(items.filter((item) => item && typeof item.Name === 'string').map((item) => [item.Name as string, item.Value]));
}

export interface MpesaCallbackEvent {
  Body?: { stkCallback?: StkCallback };
}

/**
 * Handles a Daraja STK callback: binds it to the stored payment, re-validates
 * amount/phone/receipt, then confirms the final state with an authoritative
 * STK Query before settling. Daraja callbacks are not signed, so the query is
 * the source of truth.
 */
export async function handleMpesaCallback(event: MpesaCallbackEvent, mpesa: MpesaClient, db: Database = getDb()): Promise<Payment | null> {
  const callback = event?.Body?.stkCallback;
  if (!callback || typeof callback.CheckoutRequestID !== 'string') {
    throw new AppError('Invalid M-Pesa callback event.', 400, 'invalid_callback');
  }
  const [payment] = await db.select().from(payments).where(eq(payments.checkoutRequestId, callback.CheckoutRequestID)).limit(1);
  if (!payment) return null;

  if (String(callback.ResultCode) !== '0') {
    return confirmPaymentByQuery(payment.id, mpesa, db);
  }

  const metadata = extractMetadata(callback);
  const merchantMatches = !payment.merchantRequestId || callback.MerchantRequestID === payment.merchantRequestId;
  const valid =
    merchantMatches &&
    Number(metadata.Amount) === payment.amountKes &&
    normalizeKenyanPhone(metadata.PhoneNumber) === payment.phone &&
    typeof metadata.MpesaReceiptNumber === 'string' &&
    RECEIPT_PATTERN.test(metadata.MpesaReceiptNumber);
  if (!valid) return payment;

  const query = await mpesa.stkQuery(payment.checkoutRequestId!);
  if (query.resultCode !== 0) return payment;

  return settlePayment(payment.id, { receipt: metadata.MpesaReceiptNumber as string, resultCode: 0 }, db);
}
