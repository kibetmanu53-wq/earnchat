const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const PORT = Number(process.env.PORT || 3000);
const COOKIE_NAME = 'earnchat_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FEE_AMOUNTS = Object.freeze({ verification: 150, beginner_membership: 499 });
const CHAT_EARNINGS_KES = Object.freeze({ advanced: 1300, premium: 2500 });
const MINIMUM_WITHDRAWAL_KES = 3500;
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error('Set SESSION_SECRET to a random value with at least 32 characters before starting EarnChat.');
}

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(process.env.DB_PATH || path.join(DATA_DIR, 'earnchat.sqlite'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS earnings_ledger (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_kes INTEGER NOT NULL CHECK(amount_kes > 0),
    source TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_kes INTEGER NOT NULL CHECK(amount_kes > 0),
    phone TEXT NOT NULL,
    fee_payment_id TEXT,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS fee_payments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    withdrawal_id TEXT REFERENCES withdrawal_requests(id),
    kind TEXT NOT NULL CHECK(kind IN ('verification', 'withdrawal_fee')),
    amount_kes INTEGER NOT NULL CHECK(amount_kes > 0),
    phone TEXT NOT NULL,
    status TEXT NOT NULL,
    checkout_request_id TEXT UNIQUE,
    merchant_request_id TEXT,
    mpesa_receipt TEXT,
    result_code INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS fee_payments_user_created ON fee_payments(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS earnings_ledger_user_created ON earnings_ledger(user_id, created_at DESC);
`);
if (!db.prepare('PRAGMA table_info(users)').all().some((column) => column.name === 'membership_plan')) {
  db.exec('ALTER TABLE users ADD COLUMN membership_plan TEXT');
}
db.exec(`
  CREATE TABLE IF NOT EXISTS membership_payments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL CHECK(plan = 'beginner'),
    amount_kes INTEGER NOT NULL CHECK(amount_kes = 499),
    phone TEXT NOT NULL,
    status TEXT NOT NULL,
    checkout_request_id TEXT UNIQUE,
    merchant_request_id TEXT,
    mpesa_receipt TEXT,
    result_code INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS eligible_chats (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chat_reference TEXT NOT NULL UNIQUE,
    participant_user_ids TEXT NOT NULL,
    completed_minutes INTEGER NOT NULL CHECK(completed_minutes >= 5),
    amount_kes INTEGER NOT NULL CHECK(amount_kes > 0),
    created_at TEXT NOT NULL
  );
`);
for (const table of ['fee_payments', 'membership_payments']) {
  if (!db.prepare(`PRAGMA table_info(${table})`).all().some((column) => column.name === 'provider_reference')) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN provider_reference TEXT`);
  }
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  res.end(body);
  return true;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function hashSessionToken(token) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET).update(token).digest('hex');
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 16_384) {
        reject(Object.assign(new Error('Request body is too large.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const body = await readRawBody(req);
  try {
    return body.length ? JSON.parse(body.toString('utf8')) : {};
  } catch {
    throw Object.assign(new Error('Invalid JSON body.'), { status: 400 });
  }
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => {
    const index = part.indexOf('=');
    if (index < 0) return ['', ''];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

function requireSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function currentUser(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!token) return null;
  const tokenHash = hashSessionToken(token);
  const row = db.prepare(`
    SELECT users.id, users.email, users.display_name, users.verified, users.membership_plan
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get(tokenHash, Date.now());
  return row || null;
}

function setSessionCookie(res, token) {
  res.setHeader('set-cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
}

function clearSessionCookie(res) {
  res.setHeader('set-cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
}

function userPayload(user) {
  const earnings = db.prepare('SELECT COALESCE(SUM(amount_kes), 0) AS total FROM earnings_ledger WHERE user_id = ?').get(user.id).total;
  const reserved = db.prepare(`
    SELECT COALESCE(SUM(amount_kes), 0) AS total FROM withdrawal_requests
    WHERE user_id = ? AND status IN ('fee_pending', 'fee_paid_pending_payout', 'payout_pending')
  `).get(user.id).total;
  const paidFees = db.prepare(`
    SELECT COALESCE(SUM(amount_kes), 0) AS total FROM fee_payments WHERE user_id = ? AND status = 'paid'
  `).get(user.id).total;
  const paidFeesByKind = Object.fromEntries(db.prepare(`
    SELECT kind, SUM(amount_kes) AS total FROM fee_payments
    WHERE user_id = ? AND status = 'paid' GROUP BY kind
  `).all(user.id).map((fee) => [fee.kind, fee.total]));
  const fees = db.prepare(`
    SELECT kind, amount_kes, status, provider_reference, created_at
    FROM fee_payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
  `).all(user.id);
  const membershipFees = db.prepare(`
    SELECT COALESCE(SUM(amount_kes), 0) AS total FROM membership_payments
    WHERE user_id = ? AND status = 'paid'
  `).get(user.id).total;
  const eligibleChats = db.prepare(`
    SELECT chat_reference, completed_minutes, amount_kes, created_at
    FROM eligible_chats WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
  `).all(user.id);
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    verified: Boolean(user.verified),
    earningsBalanceKes: earnings,
    availableToWithdrawKes: Math.max(0, earnings - reserved),
    paidFeesKes: paidFees,
    paidFeesByKind,
    membershipPlan: user.membership_plan || null,
    membershipFeesKes: membershipFees,
    eligibleChats,
    fees
  };
}

function paystackConfigError() {
  if (!process.env.PAYSTACK_SECRET_KEY) return 'Set PAYSTACK_SECRET_KEY in the server environment.';
  if (!/^sk_(test|live)_/.test(process.env.PAYSTACK_SECRET_KEY)) {
    return 'PAYSTACK_SECRET_KEY must be a Paystack test or live secret key.';
  }
  if (!process.env.PAYSTACK_CALLBACK_URL) return 'Set PAYSTACK_CALLBACK_URL to your public website URL.';
  try {
    const callback = new URL(process.env.PAYSTACK_CALLBACK_URL);
    if (callback.protocol !== 'https:' && (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1'].includes(callback.hostname))) {
      return 'PAYSTACK_CALLBACK_URL must use HTTPS.';
    }
  } catch {
    return 'PAYSTACK_CALLBACK_URL must be a valid URL.';
  }
  return null;
}

async function paystackRequest(endpoint, options = {}) {
  const response = await fetch(`https://api.paystack.co${endpoint}`, {
    ...options,
    headers: {
      authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers
    }
  });
  const body = await response.json();
  if (!response.ok || body.status !== true) {
    throw new Error(body.message || 'Paystack could not complete the transaction request.');
  }
  return body;
}

async function initializePaystackPayment({ user, amountKes, paymentId, kind }) {
  const callback = new URL(process.env.PAYSTACK_CALLBACK_URL);
  callback.searchParams.set('payment', 'paystack');
  callback.searchParams.set('payment_id', paymentId);
  const reference = `ec_${paymentId.replaceAll('-', '')}`;
  const result = await paystackRequest('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: user.email,
      amount: amountKes * 100,
      currency: 'KES',
      reference,
      callback_url: callback.toString(),
      metadata: { payment_id: paymentId, kind }
    })
  });
  let checkoutUrl;
  try {
    checkoutUrl = new URL(result.data?.authorization_url);
  } catch {
    throw new Error('Paystack returned an invalid checkout URL.');
  }
  if (checkoutUrl.protocol !== 'https:'
    || checkoutUrl.hostname !== 'checkout.paystack.com'
    || result.data.reference !== reference) {
    throw new Error('Paystack returned an invalid checkout response.');
  }
  return { reference, url: checkoutUrl.toString() };
}

function findPaystackPaymentById(paymentId) {
  const fee = db.prepare('SELECT * FROM fee_payments WHERE id = ?').get(paymentId);
  if (fee) return { ...fee, table: 'fee_payments', kind: fee.kind };
  const membership = db.prepare('SELECT * FROM membership_payments WHERE id = ?').get(paymentId);
  return membership ? { ...membership, table: 'membership_payments', kind: 'beginner_membership' } : null;
}

function validPaystackSignature(rawBody, signature) {
  if (!process.env.PAYSTACK_SECRET_KEY || typeof signature !== 'string' || !/^[0-9a-f]{128}$/i.test(signature)) return false;
  const expected = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(rawBody).digest();
  const actual = Buffer.from(signature, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

async function verifyPaystackPayment(payment, reference = payment?.checkout_request_id) {
  if (!payment || typeof reference !== 'string' || !reference || payment.status === 'paid') return payment;
  const result = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
  const transaction = result.data;
  if (!transaction
    || transaction.reference !== reference
    || transaction.metadata?.payment_id !== payment.id) return payment;
  const status = transaction.status === 'success'
    && transaction.currency === 'KES'
    && Number(transaction.amount) === payment.amount_kes * 100 ? 'paid'
    : ['failed', 'abandoned'].includes(transaction.status) ? 'failed' : payment.status;
  if (status === payment.status) return { ...payment, status };

  db.exec('BEGIN IMMEDIATE');
  try {
    const updated = db.prepare(`
      UPDATE ${payment.table}
      SET status = ?, provider_reference = ?, updated_at = ?
      WHERE id = ? AND status IN ('initiating', 'pending')
    `).run(
      status,
      status === 'paid' ? String(transaction.id) : null,
      new Date().toISOString(),
      payment.id
    );
    if (updated.changes && status === 'paid' && payment.kind === 'verification') {
      db.prepare('UPDATE users SET verified = 1 WHERE id = ?').run(payment.user_id);
    }
    if (updated.changes && status === 'paid' && payment.kind === 'beginner_membership') {
      db.prepare("UPDATE users SET membership_plan = 'beginner' WHERE id = ?").run(payment.user_id);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return findPaystackPaymentById(payment.id);
}
async function handleApi(req, res, url) {
  if (url.pathname === '/api/health' && req.method === 'GET') {
    const paymentEnvironment = process.env.PAYSTACK_SECRET_KEY?.startsWith('sk_live_') ? 'live'
      : process.env.PAYSTACK_SECRET_KEY?.startsWith('sk_test_') ? 'test'
        : process.env.PAYSTACK_SECRET_KEY ? 'unknown' : 'not_configured';
    return json(res, 200, {
      ok: true,
      paymentsConfigured: !paystackConfigError(),
      paymentProvider: 'paystack',
      paymentEnvironment,
      withdrawalsEnabled: false
    });
  }

  if (url.pathname === '/api/paystack/webhook' && req.method === 'POST') {
    const rawBody = await readRawBody(req);
    if (!validPaystackSignature(rawBody, req.headers['x-paystack-signature'])) {
      return json(res, 401, { error: 'Invalid Paystack webhook signature.' });
    }
    let event;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return json(res, 400, { error: 'Invalid Paystack webhook JSON.' });
    }
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      return json(res, 400, { error: 'Invalid Paystack webhook event.' });
    }
    if (event.event === 'charge.success' && typeof event.data?.reference === 'string') {
      const fee = db.prepare('SELECT id FROM fee_payments WHERE checkout_request_id = ?').get(event.data.reference);
      const membership = fee ? null : db.prepare('SELECT id FROM membership_payments WHERE checkout_request_id = ?').get(event.data.reference);
      const payment = findPaystackPaymentById((fee || membership)?.id);
      if (payment) await verifyPaystackPayment(payment, event.data.reference);
    }
    return json(res, 200, { received: true });
  }
  if (!url.pathname.startsWith('/api/')) return false;
  if (req.method !== 'GET' && !requireSameOrigin(req)) return json(res, 403, { error: 'Cross-origin request denied.' });

  if (url.pathname === '/api/internal/eligible-chat' && req.method === 'POST') {
    const secret = process.env.EARNINGS_ADMIN_SECRET || '';
    if (!secret || secret.length < 32) return json(res, 503, { error: 'Eligible-chat crediting is not configured.' });
    if (!safeEqual(req.headers['x-earnings-admin-secret'] || '', secret)) return json(res, 401, { error: 'Unauthorized earnings event.' });
    const body = await readJson(req);
    const userId = String(body.userId || '');
    const chatReference = String(body.chatReference || '').trim();
    const participantUserIds = body.participantUserIds;
    const completedMinutes = Number(body.completedMinutes);
    if (!/^[0-9a-f-]{36}$/i.test(userId)
      || chatReference.length < 8 || chatReference.length > 128
      || !Array.isArray(participantUserIds) || participantUserIds.length < 2 || participantUserIds.length > 20
      || !participantUserIds.every((id) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id))
      || new Set(participantUserIds).size !== participantUserIds.length
      || !participantUserIds.includes(userId)
      || !Number.isSafeInteger(completedMinutes) || completedMinutes < 5) {
      return json(res, 400, { error: 'Provide a completed five-minute chat with distinct valid account IDs.' });
    }
    const earningUser = db.prepare('SELECT verified, membership_plan FROM users WHERE id = ?').get(userId);
    if (!earningUser || !earningUser.verified || !CHAT_EARNINGS_KES[earningUser.membership_plan]) {
      return json(res, 403, { error: 'A verified Advanced or Premium account is required to earn from chats.' });
    }
    const placeholders = participantUserIds.map(() => '?').join(', ');
    const verifiedParticipants = db.prepare(`
      SELECT id FROM users WHERE verified = 1 AND id IN (${placeholders})
    `).all(...participantUserIds);
    if (verifiedParticipants.length !== participantUserIds.length) {
      return json(res, 400, { error: 'Every eligible-chat participant must be a verified account.' });
    }
    const amount = CHAT_EARNINGS_KES[earningUser.membership_plan];
    const now = new Date().toISOString();
    const creditId = crypto.randomUUID();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(`
        INSERT INTO eligible_chats(id, user_id, chat_reference, participant_user_ids, completed_minutes, amount_kes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(creditId, userId, chatReference, JSON.stringify(participantUserIds), completedMinutes, amount, now);
      db.prepare(`
        INSERT INTO earnings_ledger(id, user_id, amount_kes, source, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), userId, amount, `eligible_chat:${chatReference}`, now);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      if (String(error.message).includes('UNIQUE')) return json(res, 409, { error: 'This chat has already been credited.' });
      throw error;
    }
    return json(res, 201, { chatReference, amountKes: amount, membershipPlan: earningUser.membership_plan });
  }

  if (url.pathname === '/api/register' && req.method === 'POST') {
    const body = await readJson(req);
    const email = String(body.email || '').trim().toLowerCase();
    const displayName = String(body.displayName || '').trim();
    const password = String(body.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || displayName.length < 2 || displayName.length > 80 || password.length < 10 || password.length > 256) {
      return json(res, 400, { error: 'Enter a valid email, a display name, and a password of at least 10 characters.' });
    }
    const salt = crypto.randomBytes(16);
    const passwordHash = crypto.scryptSync(password, salt, 64);
    const userId = crypto.randomUUID();
    try {
      db.prepare(`
        INSERT INTO users(id, email, display_name, password_salt, password_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId, email, displayName, salt.toString('hex'), passwordHash.toString('hex'), new Date().toISOString());
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) return json(res, 409, { error: 'An account with that email already exists.' });
      throw error;
    }
    const token = crypto.randomBytes(32).toString('base64url');
    db.prepare('INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
      hashSessionToken(token), userId, Date.now() + SESSION_TTL_MS
    );
    setSessionCookie(res, token);
    return json(res, 201, { user: userPayload(db.prepare('SELECT * FROM users WHERE id = ?').get(userId)) });
  }

  if (url.pathname === '/api/login' && req.method === 'POST') {
    const body = await readJson(req);
    const email = String(body.email || '').trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || typeof body.password !== 'string' || body.password.length > 256) return json(res, 401, { error: 'Email or password is incorrect.' });
    const expected = Buffer.from(user.password_hash, 'hex');
    const actual = crypto.scryptSync(body.password, Buffer.from(user.password_salt, 'hex'), expected.length);
    if (!safeEqual(expected, actual)) return json(res, 401, { error: 'Email or password is incorrect.' });
    const token = crypto.randomBytes(32).toString('base64url');
    db.prepare('INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
      hashSessionToken(token), user.id, Date.now() + SESSION_TTL_MS
    );
    setSessionCookie(res, token);
    return json(res, 200, { user: userPayload(user) });
  }

  if (url.pathname === '/api/logout' && req.method === 'POST') {
    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashSessionToken(token));
    clearSessionCookie(res);
    return json(res, 200, { ok: true });
  }

  const user = currentUser(req);
  if (url.pathname === '/api/me' && req.method === 'GET') {
    return json(res, 200, { user: user ? userPayload(user) : null });
  }
  if (!user) return json(res, 401, { error: 'Sign in is required.' });

  if (url.pathname === '/api/profile' && req.method === 'POST') {
    const body = await readJson(req);
    const displayName = String(body.displayName || '').trim();
    if (displayName.length < 2 || displayName.length > 80) {
      return json(res, 400, { error: 'Display name must be between 2 and 80 characters.' });
    }
    db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(displayName, user.id);
    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    return json(res, 200, { user: userPayload(updated) });
  }

  if (url.pathname === '/api/payments' && req.method === 'POST') {
    const body = await readJson(req);
    const kind = body.kind;
    if (kind === 'withdrawal_fee') {
      return json(res, 503, { error: 'Withdrawal-fee collection is disabled until an authorized payout service is configured.' });
    }
    const amount = FEE_AMOUNTS[kind];
    if (!['verification', 'beginner_membership'].includes(kind) || !amount) return json(res, 400, { error: 'Choose a valid payment type.' });
    if (kind === 'verification' && user.verified) return json(res, 409, { error: 'This account is already verified.' });
    if (kind === 'beginner_membership' && !user.verified) return json(res, 403, { error: 'Verify your account before purchasing a membership.' });
    if (kind === 'beginner_membership' && user.membership_plan) return json(res, 409, { error: 'A membership plan is already active.' });
    const paymentTable = kind === 'beginner_membership' ? 'membership_payments' : 'fee_payments';
    const pending = db.prepare(`
      SELECT id FROM ${paymentTable}
      WHERE user_id = ? AND status IN ('initiating', 'pending') AND created_at > ?
      ORDER BY created_at DESC LIMIT 1
    `).get(user.id, new Date(Date.now() - 180_000).toISOString());
    if (pending) return json(res, 409, { error: 'A payment is already pending. Complete checkout or wait for its confirmation.' });

    const configError = paystackConfigError();
    if (configError) return json(res, 503, { error: `Live payment setup is incomplete. ${configError}` });

    const paymentId = crypto.randomUUID();
    const now = new Date().toISOString();
    if (kind === 'beginner_membership') {
      db.prepare(`
        INSERT INTO membership_payments(id, user_id, plan, amount_kes, phone, status, created_at, updated_at)
        VALUES (?, ?, 'beginner', ?, ?, 'initiating', ?, ?)
      `).run(paymentId, user.id, amount, '', now, now);
    } else {
      db.prepare(`
        INSERT INTO fee_payments(id, user_id, kind, amount_kes, phone, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'initiating', ?, ?)
      `).run(paymentId, user.id, kind, amount, '', now, now);
    }

    try {
      const result = await initializePaystackPayment({ user, amountKes: amount, paymentId, kind });
      db.prepare(`
        UPDATE ${paymentTable}
        SET status = 'pending', checkout_request_id = ?, updated_at = ?
        WHERE id = ?
      `).run(result.reference, new Date().toISOString(), paymentId);
      return json(res, 202, {
        paymentId,
        kind,
        feeAmountKes: amount,
        checkoutUrl: result.url,
        status: 'pending',
        message: 'Paystack checkout initialized. Your payment will be confirmed by the server before your account is updated.'
      });
    } catch (error) {
      db.prepare(`UPDATE ${paymentTable} SET status = 'initiation_failed', updated_at = ? WHERE id = ?`)
        .run(new Date().toISOString(), paymentId);
      return json(res, 502, { error: error.message || 'Could not start Paystack checkout.' });
    }
  }

  if (url.pathname === '/api/membership' && req.method === 'POST') {
    const body = await readJson(req);
    if (!user.verified) return json(res, 403, { error: 'Verify your account before choosing a membership plan.' });
    if (!['advanced', 'premium'].includes(body.plan)) {
      return json(res, 400, { error: 'Choose Advanced or Premium. Beginner requires a confirmed KSh 499 payment.' });
    }
    if (user.membership_plan === 'beginner') {
      return json(res, 409, { error: 'A paid Beginner membership is active and cannot be replaced.' });
    }
    const pendingBeginnerPayment = db.prepare(`
      SELECT id FROM membership_payments
      WHERE user_id = ? AND status IN ('initiating', 'pending')
      ORDER BY created_at DESC LIMIT 1
    `).get(user.id);
    if (pendingBeginnerPayment) {
      return json(res, 409, { error: 'Complete or cancel your pending Beginner checkout before changing plans.' });
    }
    db.prepare('UPDATE users SET membership_plan = ? WHERE id = ?').run(body.plan, user.id);
    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    return json(res, 200, { user: userPayload(updated) });
  }

  if (url.pathname === '/api/withdrawals' && req.method === 'POST') {
    const body = await readJson(req);
    const amount = Number(body.amountKes);
    if (!user.verified) return json(res, 403, { error: 'Verify your account before requesting a withdrawal.' });
    if (!Number.isSafeInteger(amount) || amount < MINIMUM_WITHDRAWAL_KES) {
      return json(res, 400, { error: `The minimum withdrawal is KSh ${MINIMUM_WITHDRAWAL_KES}.` });
    }
    const available = userPayload(user).availableToWithdrawKes;
    if (amount > available) return json(res, 400, { error: 'Withdrawal amount exceeds your available eligible earnings.' });
    return json(res, 503, { error: 'Withdrawals are unavailable until an authorized payout service is configured. No fee has been charged.' });
  }

  if (url.pathname === '/api/withdrawals' && req.method === 'GET') {
    const requests = db.prepare(`
      SELECT id, amount_kes, status, created_at FROM withdrawal_requests
      WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
    `).all(user.id);
    return json(res, 200, { withdrawals: requests });
  }

  if (url.pathname === '/api/paystack/return' && req.method === 'GET') {
    const paymentId = url.searchParams.get('payment_id') || '';
    const payment = findPaystackPaymentById(paymentId);
    if (!payment || payment.user_id !== user.id) return json(res, 404, { error: 'Payment not found.' });
    const confirmed = await verifyPaystackPayment(payment);
    return json(res, 200, {
      payment: {
        id: confirmed.id,
        kind: confirmed.kind,
        status: confirmed.status
      }
    });
  }

  const paymentMatch = url.pathname.match(/^\/api\/payments\/([0-9a-f-]+)$/i);
  if (paymentMatch && req.method === 'GET') {
    let payment = findPaystackPaymentById(paymentMatch[1]);
    if (!payment || payment.user_id !== user.id) return json(res, 404, { error: 'Payment not found.' });
    if (payment.status === 'pending') payment = await verifyPaystackPayment(payment);
    return json(res, 200, {
      payment: {
        id: payment.id,
        kind: payment.kind,
        amount_kes: payment.amount_kes,
        status: payment.status,
        provider_reference: payment.provider_reference,
        created_at: payment.created_at
      }
    });
  }
  return json(res, 404, { error: 'API endpoint not found.' });
}

function serveStatic(req, res, url) {
  const requested = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const filePath = path.resolve(ROOT, `.${requested}`);
  if (!filePath.startsWith(`${ROOT}${path.sep}`) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404);
    return res.end('Not found');
  }
  res.writeHead(200, {
    'content-type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream',
    'x-content-type-options': 'nosniff',
    'cache-control': 'no-store'
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (await handleApi(req, res, url)) return;
    serveStatic(req, res, url);
  } catch (error) {
    if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : 'The server could not complete this request.' });
    else res.destroy();
    if (!error.status) console.error('Request failed:', error.message);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`EarnChat listening on port ${PORT}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
