# Launch readiness

A pre-flight checklist for taking EarnChat to production. Work top to bottom and
confirm each item before opening the doors.

## 1. Runtime

- [ ] Node.js **22.9+** (`node -v`). The DB client and scripts rely on modern
      `node:net` / `loadEnvFile` APIs.
- [ ] Install with the lockfile: `npm ci` (not `npm install`).
- [ ] The full gate is green locally and in CI:
      `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`.

## 2. Secrets

Generate with `openssl rand -hex 32` and store in your host's secret manager.
Never commit them (`.env` is gitignored).

- [ ] `SESSION_SECRET` — hashes session tokens. Rotating it signs everyone out.
- [ ] `EARNINGS_ADMIN_SECRET` — a **separate** value. Required by
      `POST /api/internal/eligible-chat` (`x-earnings-admin-secret` header), which
      is the only endpoint that credits chat earnings. Restrict who holds it.

## 3. Database

- [ ] Provision PostgreSQL and set `DATABASE_URL` (TLS required by managed hosts
      such as Neon).
- [ ] Apply migrations: `npm run db:migrate` → ends with
      `migrations applied successfully!` and no pending work.
- [ ] Confirm the schema: 5 migrations applied and the tables `audit_log`,
      `rate_limit_counters`, and `auth_tokens` exist.
- [ ] Enable automated backups / PITR and restrict network access.

> Managed hosts that publish IPv6 records (e.g. Neon) can stall on hosts without
> an IPv6 route. The DB client disables Node's IPv6 auto-selection in-process, so
> `next start`, the worker, and `npm run db:migrate` all connect reliably.

## 4. Email (password reset)

- [ ] `MAIL_MODE=resend`, `RESEND_API_KEY`, and `MAIL_FROM` on a **verified**
      sending domain.
- [ ] `APP_URL` set to the public HTTPS origin — reset links are built from it.
- [ ] `MAIL_MODE=log` is rejected in production (`emailConfigured:false`); do not
      ship with it.
- [ ] Smoke test: request a password reset for a real address, confirm the email
      arrives, and that the link resolves and changes the password.

## 5. M-Pesa (Safaricom Daraja)

- [ ] `MPESA_MODE=live` — `mock` is rejected in production because it grants
      entitlements without a real payment.
- [ ] `MPESA_ENVIRONMENT=production` for go-live (use `sandbox` to rehearse).
- [ ] `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`
      (production Paybill `542542`), `MPESA_PASSKEY`.
- [ ] `MPESA_CALLBACK_URL=https://<host>/api/webhooks/mpesa` — **HTTPS required**.
- [ ] Optional defense-in-depth: `MPESA_WEBHOOK_ALLOWED_IPS` with Safaricom source
      ranges (comma-separated IPs / IPv4 CIDRs). Empty means "accept any source";
      entitlement is still gated by an authoritative STK Query, so a forged
      callback cannot grant access on its own.
- [ ] The webhook acknowledges (200) anything it will never act on and only
      returns 5xx for genuine internal failures worth retrying.

## 5a. Nexus Pay (alternative provider)

Use this instead of the Daraja section when `PAYMENT_PROVIDER=nexus_pay`.

- [ ] `PAYMENT_PROVIDER=nexus_pay`.
- [ ] `NEXUS_PAY_API_KEY` is the **secret** key (`sk_...` / `sb_...`), not the
      public `pk_...` key.
- [ ] `NEXUS_PAY_WEBHOOK_SECRET` matches the secret for the endpoint in the
      Nexus Pay dashboard.
- [ ] `NEXUS_PAY_API_BASE_URL=https://makamescopay.com` (HTTPS is required
      outside localhost).
- [ ] Dashboard webhook URL is `https://<host>/api/webhooks/nexus-pay` with
      `payment.completed` and `payment.failed` (`payment.cancelled` optional).
- [ ] An M-Pesa settlement account is configured in the Nexus Pay dashboard.
- [ ] The webhook rejects missing/invalid signatures with 401 before parsing any
      JSON, and returns 200 for duplicates and unsupported events.
- [ ] A completed event whose amount, phone, checkout id, transaction id, or
      account reference differs from the stored payment is ignored.
- [ ] Duplicate deliveries do not create a second entitlement or audit
      `payment.settled` entry.
- [ ] Nexus Pay's sandbox issues real STK prompts for small real amounts; use a
      low-value manual transaction, never automated tests.

## 6. Worker

- [ ] Run `npm run worker` as a supervised long-lived process (systemd, PM2, or a
      container) that restarts on failure.
- [ ] It reconciles pending payments every `WORKER_POLL_INTERVAL_MS`. Keep it
      running at all times — confirmation must not depend on the user staying on
      the page.
- [ ] Running more than one worker is safe (settlement is idempotent).

## 7. Web app

- [ ] `npm run build` then `npm run start` (Next.js) with the runtime env present.
- [ ] Terminate TLS in front of the app and forward `x-forwarded-for`, so rate
      limiting and the webhook allowlist see real client IPs.

## 8. Verify before opening the doors

- [ ] `GET /api/health` returns `ok:true`, `paymentsConfigured:true`,
      `paymentProvider` set to the active provider, and (for Daraja)
      `paymentMode:"live"`, `paymentEnvironment:"production"`,
      `emailConfigured:true`, `mailMode:"resend"`.
- [ ] End-to-end happy path on a real number with a small amount: sign up →
      pay KSh 150 → account activates → choose a plan.
- [ ] The 150 KES payment does **not** grant access until it is confirmed, and a
      matching `audit_log` trail exists (`payment.initiated`, `payment.settled`,
      `account.verified`).
- [ ] Repeat failed logins get rate-limited (HTTP 429).

## 9. Operations

- [ ] Logs are JSON in production (`LOG_LEVEL`, default `info`; `LOG_PRETTY=1` for
      readable output). Ship stdout/stderr to your log sink.
- [ ] `audit_log` is append-only — use it for reconciliation and never delete rows.
- [ ] Alerts on: health endpoint, worker liveness, Daraja error rates, and audit
      anomalies (e.g. repeated `payment.failed`).

## 10. Known gaps (not launch-blocking)

- Withdrawals stay disabled until an authorized M-Pesa B2C payout service exists.
- Fraud/velocity limits on eligible-chat crediting, payout reconciliation, an
  admin dashboard, 2FA, and KYC/AML are future work.
