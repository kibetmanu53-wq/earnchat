export const MEMBERSHIP_PLANS = ['beginner', 'advanced', 'premium'] as const;
export type MembershipPlan = (typeof MEMBERSHIP_PLANS)[number];

export const PAYMENT_TYPES = ['verification', 'beginner_membership', 'withdrawal_fee'] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

/** Fixed, server-defined fees. Never trust an amount sent by the client. */
export const FEE_AMOUNTS_KES: Record<'verification' | 'beginner_membership', number> = Object.freeze({
  verification: 150,
  beginner_membership: 499
});

/** Amount credited per eligible chat, by active membership plan. */
export const CHAT_EARNINGS_KES: Record<'advanced' | 'premium', number> = Object.freeze({
  advanced: 1300,
  premium: 2500
});

export const MINIMUM_WITHDRAWAL_KES = 3500;
export const WITHDRAWAL_FEE_KES = 50;
export const MIN_CHAT_MINUTES = 5;

export const PAYPBILL_SHORTCODE = '542542';
export const ACCOUNT_REFERENCE = 'EARNCHAT';
