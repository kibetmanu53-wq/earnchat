export const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Create your account',
    body: 'Sign up in seconds with an email and password. No card, no upfront cost to get started.'
  },
  {
    step: '02',
    title: 'Verify with M-Pesa',
    body: 'Pay the one-time KSh 150 verification fee through a secure Safaricom STK Push. You enter your PIN only in the official M-Pesa prompt.'
  },
  {
    step: '03',
    title: 'Choose a plan and chat',
    body: 'Pick Advanced (KSh 1,300/chat) or Premium (KSh 2,500/chat). Complete eligible 5-minute chats and watch your balance grow.'
  }
] as const;

export const PLANS = [
  {
    name: 'Beginner',
    price: 'KSh 499',
    cadence: 'one-time',
    highlight: false,
    description: 'Unlock the core chat experience.',
    features: ['Full messaging', 'Profile and discovery', 'Upgrade anytime'],
    cta: 'Start with Beginner'
  },
  {
    name: 'Advanced',
    price: 'KSh 1,300',
    cadence: 'per eligible chat',
    highlight: true,
    description: 'Earn on every qualifying conversation.',
    features: [
      'KSh 1,300 per eligible 5-minute chat',
      'Matched with verified members',
      'Withdraw from KSh 3,500',
      'Priority support'
    ],
    cta: 'Choose Advanced'
  },
  {
    name: 'Premium',
    price: 'KSh 2,500',
    cadence: 'per eligible chat',
    highlight: false,
    description: 'Our highest earning tier.',
    features: [
      'KSh 2,500 per eligible 5-minute chat',
      'Highest matching priority',
      'Withdraw from KSh 3,500',
      'Dedicated account manager'
    ],
    cta: 'Choose Premium'
  }
] as const;

export const FAQS = [
  {
    q: 'Is my M-Pesa PIN ever shared with EarnChat?',
    a: 'No. Payments use a Safaricom STK Push and you enter your PIN only in the official M-Pesa prompt on your phone. EarnChat never asks for or stores your PIN.'
  },
  {
    q: 'How much does it cost to join?',
    a: 'Creating an account is free. Verification is a one-time KSh 150. Beginner membership is KSh 499. Advanced and Premium have no upfront fee and instead earn per eligible chat.'
  },
  {
    q: 'What counts as an eligible chat?',
    a: 'A completed chat of at least 5 minutes with a different verified member. Sample conversations never create earnings — credits come only from the trusted server endpoint.'
  },
  {
    q: 'When can I withdraw?',
    a: 'Once a verified account has at least KSh 3,500 in eligible available earnings. Withdrawals stay disabled until an authorized M-Pesa payout service is configured, and a separate KSh 50 processing fee is shown before confirmation.'
  },
  {
    q: 'Are payments secure?',
    a: 'Every successful payment must match the expected amount, phone, and receipt, and is confirmed with Safaricom before your account is activated. The browser cannot declare a payment successful.'
  }
] as const;
