import { and, eq, inArray } from 'drizzle-orm';
import { earningsLedger, eligibleChats, getDb, users, type Database } from '@earnchat/db';
import { canEarnFromChat, chatEarningAmount } from '@earnchat/domain';
import { AppError } from './errors';
import { AUDIT_ACTIONS, recordAudit } from './audit';

export interface CreditEligibleChatInput {
  userId: string;
  chatReference: string;
  participantUserIds: string[];
  completedMinutes: number;
}

export interface CreditEligibleChatResult {
  chatReference: string;
  amountKes: number;
  membershipPlan: 'advanced' | 'premium';
}

/**
 * Credits a single eligible-chat earning. Idempotent on chatReference: a repeat
 * for the same chat raises a 409 instead of double-crediting.
 */
export async function creditEligibleChat(
  input: CreditEligibleChatInput,
  db: Database = getDb()
): Promise<CreditEligibleChatResult> {
  const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!user || !canEarnFromChat(user)) {
    throw new AppError('A verified Advanced or Premium account is required to earn from chats.', 403, 'not_eligible');
  }
  if (!input.participantUserIds.includes(input.userId)) {
    throw new AppError('The earning account must be a participant in the chat.', 400, 'earning_user_not_participant');
  }

  const verifiedParticipants = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.verified, true), inArray(users.id, input.participantUserIds)));
  if (verifiedParticipants.length !== input.participantUserIds.length) {
    throw new AppError('Every eligible-chat participant must be a verified account.', 400, 'unverified_participant');
  }

  const amount = chatEarningAmount(user);
  if (!amount) throw new AppError('This account is not eligible to earn from chats.', 403, 'not_eligible');

  try {
    return await db.transaction(async (tx) => {
      const [chat] = await tx
        .insert(eligibleChats)
        .values({
          userId: user.id,
          chatReference: input.chatReference,
          participantUserIds: input.participantUserIds,
          completedMinutes: input.completedMinutes,
          amountKes: amount
        })
        .returning();
      await tx.insert(earningsLedger).values({
        userId: user.id,
        amountKes: amount,
        source: `eligible_chat:${chat?.chatReference ?? input.chatReference}`
      });
      await recordAudit(
        {
          action: AUDIT_ACTIONS.earningCredited,
          userId: user.id,
          entityType: 'eligible_chat',
          entityId: chat?.chatReference ?? input.chatReference,
          metadata: { amountKes: amount, completedMinutes: input.completedMinutes }
        },
        tx
      );
      return {
        chatReference: input.chatReference,
        amountKes: amount,
        membershipPlan: user.membershipPlan as 'advanced' | 'premium'
      };
    });
  } catch (error) {
    if (String((error as Error).message).includes('duplicate key')) {
      throw new AppError('This chat has already been credited.', 409, 'duplicate_chat');
    }
    throw error;
  }
}
