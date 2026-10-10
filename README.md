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

## Deploy on Render

The included `render.yaml` Blueprint creates a Node web service, health check, and persistent disk for the SQLite database. The disk requires a paid Render web-service plan; do not remove it for a live deployment, because Render's ordinary filesystem is temporary and contains account, payment, and earnings records. The disk also means this service should run as a single instance.

1. Push this project, including `render.yaml`, to the GitHub repository you want to deploy. Do not add `.env`, API credentials, or other secrets to GitHub.
2. In Render, choose **New > Blueprint**, connect GitHub, and select that repository. Review the paid service and persistent-disk cost before creating it.
3. Add Daraja sandbox consumer key, consumer secret, passkey, and callback URL to Render's environment settings. The sandbox shortcode is `174379`. Set callback URL to `https://<your-render-hostname>/api/mpesa/callback`.
4. After Safaricom enables production access for Paybill 542542, enter its production credentials directly in Render and set `MPESA_ENVIRONMENT=production`.
5. Visit `https://<your-render-hostname>/api/health`; confirm `"paymentsConfigured":true` and the expected environment before starting payments.

Render generates the session and earnings secrets from the Blueprint. Never paste Daraja secrets into chat, source files, or GitHub. A deployed app does not itself grant Safaricom production access or guarantee the Paybill is authorized for STK Push.

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
