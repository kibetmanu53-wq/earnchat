# EarnChat

A chat-and-earn platform: users verify with M-Pesa, choose a membership plan, and earn KSh for eligible 5-minute chats. Payments run through Safaricom Daraja (STK Push).

This is a Turborepo monorepo (npm workspaces). The original single-file prototype is preserved under `legacy/prototype/`.

## Stack

- **Next.js 16** (App Router) + **React 19** + **Tailwind CSS v4** for the web app
- **Drizzle ORM** over **PostgreSQL**
- **Zod** for input validation
- Safaricom **Daraja** M-Pesa client with a mock mode
- A standalone polling **worker** (`apps/worker`) that reconciles pending payments, with status checks also reconciling active users' payments

## Layout

```
apps/
  web/        Next.js app: marketing pages, auth, dashboard, API routes
  worker/     Background worker that confirms pending M-Pesa payments
packages/
  config/     Shared tsconfig presets
  domain/     Constants, phone normalization, earnings math
  validation/ Zod schemas
  db/         Drizzle schema + client
  payments/   Daraja client, mock client, config loading
  auth/       Password hashing (scrypt) + DB-backed sessions
  core/       Business services used by web and worker
legacy/
  prototype/  The earlier vanilla JS prototype
```

Internal packages export TypeScript source directly (no build step); Next transpiles them via `transpilePackages`.

## Requirements

- Node.js 22.9+
- A PostgreSQL database
- Optional: Docker for the bundled `docker-compose.yml`

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your environment file:

   ```bash
   cp .env.example .env
   ```

3. Fill in `.env`:
   - `DATABASE_URL` — your PostgreSQL connection string.
   - `SESSION_SECRET` and `EARNINGS_ADMIN_SECRET` — separate random strings of at least 32 characters (`openssl rand -hex 32`).
   - M-Pesa settings. Start with `MPESA_MODE=mock` for local development.

4. Start a local database (optional, if you are not using your own):

   ```bash
   docker compose up -d
   ```

5. Generate and apply the schema:

   ```bash
   npm run db:generate
   npm run db:migrate
   ```

6. Run everything:

   ```bash
   npm run dev
   ```

   Or run the pieces individually:

   ```bash
   npm run dev --workspace @earnchat/web
   npm run worker
   ```

## M-Pesa (Daraja)

- `MPESA_MODE=mock` simulates STK Push locally and succeeds on the first status query: no credentials or real prompts. Use this for development.
- `MPESA_MODE=live` uses the credentials below. Sandbox uses shortcode `174379`; production uses Paybill `542542`.
- Set `MPESA_CALLBACK_URL` to a publicly reachable URL ending in `/api/webhooks/mpesa`. Live callbacks must be HTTPS.
- The customer enters their PIN only in the official M-Pesa prompt. EarnChat never asks for or stores it.
- Daraja callbacks are unsigned, so the server re-validates amount/phone/receipt and confirms with an authoritative STK Query before activating anything. The browser cannot declare a payment successful.
- Keep the worker running in production to reconcile payments even when users leave the page. While a user is waiting on the payment screen, status checks also query Daraja so confirmation does not depend on the worker alone.

## Earnings and withdrawals

- Verification: one-time KSh 150.
- Beginner membership: one-time KSh 499.
- Advanced: KSh 1,300 per eligible chat. Premium: KSh 2,500 per eligible chat (no upfront fee).
- Earnings are credited only from the trusted endpoint `POST /api/internal/eligible-chat`, which requires the `x-earnings-admin-secret` header. Sample conversations in the UI never create earnings.
- Withdrawals are disabled until an authorized M-Pesa payout service is configured. Minimum KSh 3,500 with a separate KSh 50 processing fee.

## Scripts

| Command               | Description                     |
| --------------------- | ------------------------------- |
| `npm run dev`         | Run all dev tasks via Turborepo |
| `npm run build`       | Build all apps                  |
| `npm run lint`        | Lint all packages with ESLint   |
| `npm run format`      | Format the repo with Prettier   |
| `npm run typecheck`   | Type-check all packages         |
| `npm test`            | Run unit tests                  |
| `npm run db:generate` | Generate Drizzle migrations     |
| `npm run db:migrate`  | Apply migrations                |
| `npm run worker`      | Run the payments worker         |

CI (`.github/workflows/ci.yml`) runs lint, format check, typecheck, tests, and a
build on every push and pull request.

## Health check

`GET /api/health` reports service status, whether M-Pesa is configured, and
whether email delivery is configured.

## Launching

See [`docs/launch-readiness.md`](docs/launch-readiness.md) for the production
config checklist and pre-launch verification steps.
