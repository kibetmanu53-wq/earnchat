import { CHAT_EARNINGS_KES, type MembershipPlan } from './constants';

export interface EarningAccount {
  verified: boolean;
  membershipPlan: MembershipPlan | null;
}

/** A user may only earn from chats on a verified Advanced/Premium account. */
export function canEarnFromChat(account: EarningAccount | null | undefined): boolean {
  if (!account || !account.verified) return false;
  return account.membershipPlan === 'advanced' || account.membershipPlan === 'premium';
}

/** The KSh amount credited for one eligible chat, or null if not eligible. */
export function chatEarningAmount(account: EarningAccount | null | undefined): number | null {
  if (!account || !account.verified || !account.membershipPlan) return null;
  if (account.membershipPlan === 'advanced' || account.membershipPlan === 'premium') {
    return CHAT_EARNINGS_KES[account.membershipPlan];
  }
  return null;
}

/** Earnings minus amounts already reserved by open withdrawal requests. */
export function computeAvailableToWithdraw(earningsKes: number, reservedKes: number): number {
  return Math.max(0, earningsKes - reservedKes);
}

/** Redacts participant IDs before exposing an eligible chat to the client. */
export function summarizeParticipants(participantIds: string[]): number {
  return participantIds.length;
}
