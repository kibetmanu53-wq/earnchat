export type MailMode = 'log' | 'resend';

export interface MailConfig {
  mode: MailMode;
  from: string;
  appUrl: string;
  resendApiKey: string;
}

const APP_NAME = 'EarnChat';

export function loadMailConfig(env: NodeJS.ProcessEnv = process.env): MailConfig {
  return {
    mode: env.MAIL_MODE === 'resend' ? 'resend' : 'log',
    from: env.MAIL_FROM?.trim() || `${APP_NAME} <no-reply@earnchat.local>`,
    appUrl: (env.APP_URL?.trim() || 'http://localhost:3000').replace(/\/+$/, ''),
    resendApiKey: env.RESEND_API_KEY?.trim() ?? ''
  };
}

export function mailConfigError(config: MailConfig, env: NodeJS.ProcessEnv = process.env): string | null {
  if (config.mode === 'log') {
    return env.NODE_ENV === 'production'
      ? 'MAIL_MODE=log does not deliver email; users cannot verify or reset. Set MAIL_MODE=resend.'
      : null;
  }
  if (!config.resendApiKey) return 'Set RESEND_API_KEY.';
  return null;
}

export { APP_NAME };
