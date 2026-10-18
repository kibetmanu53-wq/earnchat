import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, boolean } from 'drizzle-orm/pg-core';

export const membershipPlanEnum = pgEnum('membership_plan', ['beginner', 'advanced', 'premium']);
export const paymentTypeEnum = pgEnum('payment_type', ['verification', 'beginner_membership', 'withdrawal_fee']);
export const paymentStatusEnum = pgEnum('payment_status', [
  'initiating',
  'pending',
  'paid',
  'failed',
  'initiation_failed'
]);
export const withdrawalStatusEnum = pgEnum('withdrawal_status', [
  'fee_pending',
  'fee_paid_pending_payout',
  'payout_pending',
  'paid',
  'failed'
]);
export const authTokenTypeEnum = pgEnum('auth_token_type', ['verify_email', 'reset_password']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  verified: boolean('verified').notNull().default(false),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  membershipPlan: membershipPlanEnum('membership_plan'),
  age: integer('age'),
  location: text('location'),
  bio: text('bio'),
  interests: text('interests'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const sessions = pgTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('sessions_user_idx').on(table.userId)]
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: paymentTypeEnum('type').notNull(),
    amountKes: integer('amount_kes').notNull(),
    phone: text('phone').notNull(),
    status: paymentStatusEnum('status').notNull().default('initiating'),
    checkoutRequestId: text('checkout_request_id').unique(),
    merchantRequestId: text('merchant_request_id'),
    providerReference: text('provider_reference'),
    resultCode: integer('result_code'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('payments_user_created_idx').on(table.userId, table.createdAt),
    index('payments_status_idx').on(table.status)
  ]
);

export const earningsLedger = pgTable(
  'earnings_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    amountKes: integer('amount_kes').notNull(),
    source: text('source').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('earnings_user_created_idx').on(table.userId, table.createdAt)]
);

export const eligibleChats = pgTable('eligible_chats', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  chatReference: text('chat_reference').notNull().unique(),
  participantUserIds: jsonb('participant_user_ids').$type<string[]>().notNull(),
  completedMinutes: integer('completed_minutes').notNull(),
  amountKes: integer('amount_kes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const withdrawalRequests = pgTable('withdrawal_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  amountKes: integer('amount_kes').notNull(),
  phone: text('phone').notNull(),
  feePaymentId: uuid('fee_payment_id'),
  status: withdrawalStatusEnum('status').notNull().default('fee_pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

/** Fixed-window rate-limit counters, shared across instances. */
export const rateLimitCounters = pgTable('rate_limit_counters', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  resetAt: timestamp('reset_at', { withTimezone: true }).notNull()
});

/** Single-use email verification and password reset tokens (hashed at rest). */
export const authTokens = pgTable(
  'auth_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: authTokenTypeEnum('type').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('auth_tokens_user_type_idx').on(table.userId, table.type)]
);

/**
 * Append-only trail of money and entitlement events. Written inside the same
 * transaction as the state change it records, so the ledger can never disagree
 * with the row it describes.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('audit_log_user_created_idx').on(table.userId, table.createdAt),
    index('audit_log_action_created_idx').on(table.action, table.createdAt)
  ]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type AuthToken = typeof authTokens.$inferSelect;
export type NewAuthToken = typeof authTokens.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
