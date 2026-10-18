import { loadMailConfig, mailConfigError, type MailConfig } from './config';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends a transactional email. In "log" mode the message is written to stdout
 * (useful for local development) and in "resend" mode it is delivered through
 * the Resend HTTP API.
 */
export async function sendEmail(message: EmailMessage, config: MailConfig = loadMailConfig()): Promise<void> {
  if (config.mode === 'log') {
    console.log(`[email:log] to=${message.to} subject=${message.subject}\n${message.text}`);
    return;
  }

  const error = mailConfigError(config);
  if (error) throw new Error(`Email is not configured. ${error}`);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.resendApiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      from: config.from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Resend rejected the email (${response.status}): ${body.slice(0, 200)}`);
  }
}
