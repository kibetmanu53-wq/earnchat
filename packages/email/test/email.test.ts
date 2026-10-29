import { describe, expect, it } from 'vitest';
import { loadMailConfig, mailConfigError, passwordResetEmail } from '../src/index';

describe('mail config', () => {
  it('defaults to log mode with a safe sender', () => {
    const config = loadMailConfig({} as NodeJS.ProcessEnv);
    expect(config.mode).toBe('log');
    expect(mailConfigError(config)).toBeNull();
  });

  it('flags log mode in production so email is not silently dropped', () => {
    const config = loadMailConfig({ MAIL_MODE: 'log' } as NodeJS.ProcessEnv);
    expect(mailConfigError(config, { NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toMatch(/does not deliver email/i);
  });

  it('requires an API key for resend mode', () => {
    const config = loadMailConfig({ MAIL_MODE: 'resend' } as NodeJS.ProcessEnv);
    expect(mailConfigError(config)).toMatch(/RESEND_API_KEY/);
  });
});

describe('templates', () => {
  it('includes the action link in reset email', () => {
    const { subject, html } = passwordResetEmail({
      displayName: 'Amina',
      url: 'https://app.test/reset-password?token=xyz'
    });
    expect(subject).toMatch(/reset/i);
    expect(html).toContain('https://app.test/reset-password?token=xyz');
  });
});
