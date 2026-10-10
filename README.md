# EarnChat

EarnChat is a chat-and-earn dashboard prototype with server-backed accounts, Safaricom Daraja M-Pesa STK Push payments, and a separate earnings ledger.

## Run locally

Use Node.js 22.9 or newer. The project uses Node's built-in SQLite module and has no third-party runtime dependencies.

1. Copy `.env.example` to `.env`.
2. Generate separate random secrets of at least 32 characters for `SESSION_SECRET` and `EARNINGS_ADMIN_SECRET`.
3. Create a Daraja app and add its consumer key and consumer secret to the server environment. Never expose these credentials in browser code, chat, or GitHub.
4. For sandbox testing, use the Daraja sandbox app credentials, sandbox passkey, and shortcode `174379`. Configure the callback URL as a publicly reachable HTTPS URL ending in `/api/mpesa/callback`.
5. Set `MPESA_ENVIRONMENT=production` only after Safaricom has enabled production access and issued production credentials for Paybill 542542; then change the shortcode to `542542`.
6. Run `npm start` and open `http://localhost:3000`. Do not open `index.html` directly as a `file:` URL.

If PowerShell blocks the `npm` script, run `npm.cmd start` and `npm.cmd test`.

## Deploy a free preview on Render

The included `render.yaml` Blueprint creates a free Node web service with generated session and earnings secrets. This is a **preview only**: Render's free filesystem is ephemeral, so SQLite accounts, sessions, and records may be lost when the service restarts, sleeps, or redeploys. Do not use real/reused passwords, collect real customer information, or accept payments on this preview. Daraja credentials are intentionally not configured.

1. Push this project, including `render.yaml`, to the GitHub repository you want to deploy. Never add `.env`, API credentials, or other secrets to GitHub.
2. In Render, choose **New > Blueprint**, connect GitHub, and select the EarnChat repository and `main` branch.
3. Review the free preview service and click **Apply** to deploy. No card should be needed for the free service; if Render still requests payment details, stop and review the plan shown before proceeding.
4. When the service is live, open its `onrender.com` URL and `/api/health`. The preview should report `paymentsConfigured:false`.

This preview has no persistent disk and no working M-Pesa checkout. For real customer accounts and payments, deploy to a paid service with persistent storage, configure a public HTTPS callback, and use Safaricom production credentials only after production approval for Paybill 542542. Sandbox credentials use shortcode `174379` and cannot collect real money. Never paste Daraja secrets into chat, source files, or GitHub.

## Persistent deployment

For a production deployment, the service needs a paid Render plan and persistent disk for SQLite records; that deployment incurs hosting charges. Keep `DB_PATH` on the mounted disk, configure the Daraja credentials and public callback URL as private environment variables, and verify `/api/health` reports the intended payment environment before accepting payments.

## Payments and policy

- Account verification: fixed one-time KSh 150 M-Pesa STK Push.
- Beginner membership: fixed KSh 499 M-Pesa STK Push.
- Advanced: KSh 1,300 per eligible chat.
- Premium: KSh 2,500 per eligible chat.
- Withdrawal minimum: KSh 3,500 in eligible available earnings.
- Withdrawal processing fee: KSh 50, displayed separately. Fee collection and withdrawals remain disabled until an authorized payout integration is available.

The customer enters a Kenyan M-Pesa phone number. EarnChat sends the fixed server-defined amount to the official M-Pesa prompt. The customer enters their PIN only in the official M-Pesa interface; EarnChat never asks for or stores it. The STK Push uses Paybill 542542 and account reference `EARNCHAT`.

The server receives the Daraja callback and queries Safaricom for the matching checkout request before recording a successful payment. Successful callbacks must include the expected amount, phone, and receipt and match the stored checkout request. The browser cannot declare payment successful. Verification and Beginner membership activate only after confirmation. Payments are recorded separately from earnings.

Advanced and Premium selections do not charge an upfront membership fee. Earnings are credited only by the protected internal eligible-chat endpoint; local sample conversations never create earnings. Production must call this endpoint only from a trusted server that verifies real chat participants and duration.

Safaricom controls Daraja production approval, shortcode authorization, settlement, and account setup. Paybill details alone do not enable automatic STK Push payments. Real payments require production Daraja credentials and public HTTPS hosting.

## Tests

Run `npm test`. Tests use a temporary SQLite database and mocked Daraja API responses; they do not send real M-Pesa prompts or contact Safaricom.
