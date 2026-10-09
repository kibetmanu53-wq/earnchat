# EarnChat

EarnChat is a chat-and-earn dashboard prototype with server-backed accounts, Paystack checkout, and a separate earnings ledger.

## Run locally

Use Node.js 22.9 or newer. The project uses Node's built-in SQLite module and has no third-party runtime dependencies.

1. Copy `.env.example` to `.env`.
2. Generate separate random secrets of at least 32 characters for `SESSION_SECRET` and `EARNINGS_ADMIN_SECRET`.
3. Add your Paystack **secret key** as `PAYSTACK_SECRET_KEY`. Keep secret keys only in the server environment; never commit `.env` or expose a secret key in browser code.
4. Set `PAYSTACK_CALLBACK_URL` to your app's public HTTPS homepage. Local `http://localhost:3000/` is allowed for local testing, but Paystack cannot redirect an external customer to a local server.
5. In the Paystack Dashboard, configure the webhook URL as `https://your-public-domain.example/api/paystack/webhook`.
6. Run `npm start` and open `http://localhost:3000`. Do not open `index.html` directly as a `file:` URL.

If PowerShell blocks the `npm` script, run `npm.cmd start` and `npm.cmd test`.

Use Paystack test keys while testing. Replace them with live keys only after Paystack approves the business and enables the payment methods needed by your account. Keep the dashboard's mobile-money/payment-channel settings in line with what Paystack has approved for the account.

## Deploy on Render

The included `render.yaml` Blueprint creates a Node web service, health check, and persistent disk for the SQLite database. The disk requires a paid Render web-service plan; do not remove it for a live deployment, because Render's ordinary filesystem is temporary and contains account, payment, and earnings records. The disk also means this service should run as a single instance.

1. Push this project, including `render.yaml`, to the GitHub repository you want to deploy. Do not add `.env`, API keys, or other secrets to GitHub.
2. In Render, choose **New > Blueprint**, connect GitHub, and select that repository. Review the paid service and persistent-disk cost before creating it.
3. Set `PAYSTACK_SECRET_KEY` in Render's environment settings, starting with a Paystack test secret. After the first deploy gives you an `onrender.com` HTTPS address, set `PAYSTACK_CALLBACK_URL` to that homepage URL.
4. Set the Paystack webhook URL to `https://<your-render-hostname>/api/paystack/webhook`.
5. Visit `https://<your-render-hostname>/api/health` and confirm it responds with `"ok":true`. Test checkout using Paystack test mode before considering live payments.

Render generates the session and earnings secrets from the Blueprint. Never paste secret keys into chat, source files, or GitHub. A hosted app URL does not mean Paystack live payments are approved, and withdrawals remain unavailable until a payout integration is added.

## Payments and policy

- Account verification: one-time KSh 150 payment.
- Beginner: KSh 499 membership payment.
- Advanced: KSh 1,300 per eligible chat.
- Premium: KSh 2,500 per eligible chat.
- Withdrawal minimum: KSh 3,500 in eligible available earnings.
- Withdrawal processing fee: KSh 50, displayed separately. Fee collection and withdrawals remain disabled until an authorized payout integration is available.

The server initializes Paystack transactions using the signed-in user's email and the server-defined amount in the smallest currency unit. Paystack checkout collects the customer's selected payment method. Account verification and Beginner membership only activate after the server confirms transaction status, KES currency, expected amount, reference, and customer email using Paystack's Verify Transaction API. The `/api/paystack/webhook` endpoint validates `x-paystack-signature` against the raw request body and re-verifies successful charges with Paystack. The browser redirect is also verified server-side; visiting the return URL alone does not prove payment.

Verification and membership payments are recorded separately from earnings. They never add to or subtract from the earnings balance. Use test mode first and verify successful, failed, abandoned, duplicate, and mismatched-amount cases before enabling live payments.

Advanced and Premium selections do not charge an upfront membership fee. Earnings are only credited by the protected internal eligible-chat endpoint; local sample conversations never create earnings. The endpoint requires a separate `EARNINGS_ADMIN_SECRET`, an Advanced or Premium verified earning account, a completed duration of at least five minutes, and at least two distinct verified participants including the earning user. A chat reference can only be credited once. Production must call it only from a trusted server that has verified real chat participants and duration.

Paystack account approval, supported payment methods, settlement currency, and merchant setup are controlled by Paystack. Adding API keys does not by itself guarantee the account can accept live payments. Do not use live credentials until account activation and the required channels are confirmed in the Paystack Dashboard.

## Tests

Run `npm test`. Tests use a temporary SQLite database and mocked Paystack API responses; they do not send real payments or contact Paystack.
