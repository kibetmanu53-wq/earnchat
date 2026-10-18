import { auditLog, getDb, type Database } from '@earnchat/db';

/** Anything exposing an `insert`: the pooled db handle or a transaction. */
type AuditWriter = Pick<Database, 'insert'>;

export interface AuditEvent {
  action: string;
  userId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Canonical action names for money and entitlement events. */
export const AUDIT_ACTIONS = {
  paymentInitiated: 'payment.initiated',
  paymentInitiationFailed: 'payment.initiation_failed',
  paymentSettled: 'payment.settled',
  paymentFailed: 'payment.failed',
  accountVerified: 'account.verified',
  membershipActivated: 'membership.activated',
  earningCredited: 'earning.credited'
} as const;

/**
 * Appends an entry to the audit trail. Pass the surrounding transaction as `db`
 * to keep the record atomic with the state change it describes, so the ledger
 * can never disagree with the row it documents.
 */
export async function recordAudit(event: AuditEvent, db: AuditWriter = getDb()): Promise<void> {
  await db.insert(auditLog).values({
    action: event.action,
    userId: event.userId ?? null,
    entityType: event.entityType ?? null,
    entityId: event.entityId ?? null,
    metadata: event.metadata ?? null
  });
}
