import { APP_NAME } from './config';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface TemplateInput {
  displayName: string;
  url: string;
}

function layout(heading: string, body: string, ctaLabel: string, url: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f5f0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c2712;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e6d8;border-radius:12px;">
      <tr>
        <td style="padding:28px 28px 8px;">
          <p style="margin:0;font-size:20px;font-weight:800;">earn<span style="color:#7ea832;">chat</span></p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 28px 0;">
          <h1 style="margin:0 0 12px;font-size:20px;">${heading}</h1>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#49523b;">${body}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 28px;">
          <a href="${url}" style="display:inline-block;background:#7ea832;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;">${ctaLabel}</a>
          <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#8a927c;">If the button does not work, paste this link into your browser:<br /><span style="word-break:break-all;">${url}</span></p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 28px;border-top:1px solid #e2e6d8;">
          <p style="margin:0;font-size:12px;color:#8a927c;">You received this email from ${APP_NAME}. If this was not you, you can ignore it.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function verificationEmail({ displayName, url }: TemplateInput): RenderedEmail {
  return {
    subject: 'Verify your EarnChat email',
    html: layout(
      'Confirm your email',
      `Hi ${displayName}, welcome to ${APP_NAME}. Confirm your email address to continue setting up your account. This link expires in 24 hours.`,
      'Verify email',
      url
    ),
    text: `Hi ${displayName}, confirm your ${APP_NAME} email address (link expires in 24 hours):\n\n${url}\n`
  };
}

export function passwordResetEmail({ displayName, url }: TemplateInput): RenderedEmail {
  return {
    subject: 'Reset your EarnChat password',
    html: layout(
      'Reset your password',
      `Hi ${displayName}, we received a request to reset your password. This link expires in 1 hour. If you did not request it, no action is needed and your password stays the same.`,
      'Reset password',
      url
    ),
    text: `Hi ${displayName}, reset your ${APP_NAME} password (link expires in 1 hour):\n\n${url}\n\nIf you did not request this, ignore this email.\n`
  };
}
