# EarnChat

EarnChat is a chat-and-earn dashboard prototype with server-backed accounts, Paystack hosted checkout, and a separate earnings ledger.

## Run locally

Use Node.js 22.9 or newer. The project uses Node's built-in SQLite module and has no third-party runtime dependencies.

1. Copy `.env.example` to `.env`.
2. Generate separate random secrets of at least 32 characters for `SESSION_SECRET` and `EARNINGS_ADMIN_SECRET`.
3. Add your Paystack secret key as `PAYSTACK_SECRET_KEY`. Keep it only in the server environment; never commit `.env` or expose the key in browser code.
4. Set `PAYSTACK_CALLBACK_URL` to your app's public HTTPS homepage. Local `http://localhost:3000/` is allowed for local testing, but Paystack cannot send webhooks to a local server.
5. Run `npm start` and open `http://localhost:3000`. Do not open `index.html` directly as a `file:` URL.

If PowerShell blocks the `npm` script, run `npm.cmd start` and `npm.cmd test`.

Use Paystack test keys while testing. Use live keys only when the Paystack business account has been activated and KES plus the intended payment channels are enabled.

## Deploy on Render

The included `render.yaml` Blueprint creates a Node web service, health check, and persistent disk for the SQLite database. The disk requires a paid Render web-service plan; do not remove it for a live deployment, because Render's ordinary filesystem is temporary and contains account, payment, and earnings records. The disk also means this service should run as a single instance.

1. Push this project, including `render.yaml`, to the GitHub repository you want to deploy. Do not add `.env`, API keys, or other secrets to GitHub.
2. In Render, choose **New > Blueprint**, connect GitHub, and select that repository. Review the paid service and persistent-disk cost before creating it.
3. Set `PAYSTACK_SECRET_KEY` in Render's environment settings, starting with a Paystack test secret key. After the first deploy gives you an `onrender.com` HTTPS address, set `PAYSTACK_CALLBACK_URL` to that homepage URL.
4. In Paystack Dashboard > **Settings > API Keys & Webhooks**, configure the webhook URL as `https://<your-render-hostname>/api/paystack/webhook`.
5. Visit `https://<your-render-hostname>/api/health` and confirm it responds with `"ok":true`, `"paymentsConfigured":true`, and the expected payment environment. Test checkout before switching to a live key.
6. Once ready for real transactions, replace the test secret with your live secret directly in Render, confirm live KES and payment channels are enabled in Paystack, and redeploy.

Render generates the session and earnings secrets from the Blueprint. Never paste Paystack secret keys into chat, source files, or GitHub. A deployed URL does not itself enable live transactions; that depends on Paystack approving the account and the selected currency/payment methods.

## Payments and policy

- Account verification: one-time KSh 150 Paystack payment.
- Beginner: KSh 499 membership payment.
- Advanced: KSh 1,300 per eligible chat.
- Premium: KSh 2,500 per eligible chat.
- Withdrawal minimum: KSh 3,500 in eligible available earnings.
- Withdrawal processing fee: KSh 50, displayed separately. Fee collection and withdrawals remain disabled until an authorized payout integration is available.

The server initializes Paystack checkout with the user's email, a server-defined fixed amount in KES (in the currency's minor unit), a unique transaction reference, and internal payment metadata. The customer completes payment on Paystack's hosted checkout. Paystack returns to the website and sends a webhook; the app checks the webhook's HMAC SHA-512 signature and independently verifies the transaction with Paystack before marking the payment successful. The server requires the exact reference, internal payment ID, KES currency, successful status, and exact expected amount before activating verification or Beginner membership.

Verification and membership payments are recorded separately from earnings. They never add to or subtract from the earnings balance. Test successful, failed, abandoned, duplicate, and mismatched-amount cases before enabling live payments.

Advanced and Premium selections do not charge an upfront membership fee. Earnings are only credited by the protected internal eligible-chat endpoint; local sample conversations never create earnings. The endpoint requires a separate `EARNINGS_ADMIN_SECRET`, an Advanced or Premium verified earning account, a completed duration of at least five minutes, and at least two distinct verified participants including the earning user. A chat reference can only be credited once. Production must call it only from a trusted server that has verified real chat participants and duration.

Paystack account approval, settlement currency, supported payment methods, and merchant setup are controlled by Paystack. Adding an API key does not by itself guarantee that the account can accept live payments. Withdrawals remain unavailable until a payout integration is added.

## Tests

Run `npm test`. Tests use a temporary SQLite database and mocked Paystack API responses; they do not send real payments or contact Paystack.
