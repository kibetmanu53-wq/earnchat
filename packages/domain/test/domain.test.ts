import { describe, expect, it } from 'vitest';
import { chatEarningAmount, computeAvailableToWithdraw, normalizeKenyanPhone, canEarnFromChat } from '../src/index';

describe('normalizeKenyanPhone', () => {
  it('normalizes local, international and spaced formats', () => {
    expect(normalizeKenyanPhone('0712 345 678')).toBe('254712345678');
    expect(normalizeKenyanPhone('+254712345678')).toBe('254712345678');
    expect(normalizeKenyanPhone('254712345678')).toBe('254712345678');
    expect(normalizeKenyanPhone('0110000000')).toBe('254110000000');
  });

  it('rejects invalid numbers', () => {
    expect(normalizeKenyanPhone('12345')).toBeNull();
    expect(normalizeKenyanPhone('')).toBeNull();
    expect(normalizeKenyanPhone('0712345')).toBeNull();
  });
});

describe('eligibility and earnings', () => {
  it('only earns on verified advanced/premium accounts', () => {
    expect(canEarnFromChat({ verified: true, membershipPlan: 'premium' })).toBe(true);
    expect(canEarnFromChat({ verified: true, membershipPlan: 'beginner' })).toBe(false);
    expect(canEarnFromChat({ verified: false, membershipPlan: 'advanced' })).toBe(false);
    expect(chatEarningAmount({ verified: true, membershipPlan: 'advanced' })).toBe(1300);
    expect(chatEarningAmount({ verified: true, membershipPlan: 'premium' })).toBe(2500);
  });

  it('never lets available balance go negative', () => {
    expect(computeAvailableToWithdraw(3800, 3500)).toBe(300);
    expect(computeAvailableToWithdraw(1000, 3500)).toBe(0);
  });
});
