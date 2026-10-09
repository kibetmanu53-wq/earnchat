const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { once } = require('node:events');
const test = require('node:test');

test('accounts use server sessions and fees never become earnings', async (t) => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'earnchat-test-'));
  const port = 32000 + Math.floor(Math.random() * 20000);
  const databasePath = path.join(tempDirectory, 'test.sqlite');
  const earningsSecret = 'test-only-earnings-secret-that-is-long-enough';
  const paystackSecret = 'sk_test_fake_key_for_integration_tests';
  const mockPaystack = `
    const transactions = new Map();
    global.fetch = async (input, options = {}) => {
      const url = new URL(input);
      if (url.hostname !== 'api.paystack.co') throw new Error('Unexpected external request in test');
      if (url.pathname === '/transaction/initialize') {
        const request = JSON.parse(options.body);
        transactions.set(request.reference, {
          reference: request.reference,
          amount: request.amount,
          currency: request.currency,
          status: 'success',
          customer: { email: request.email }
        });
        return new Response(JSON.stringify({
          status: true,
          data: { authorization_url: 'https://checkout.paystack.com/test', reference: request.reference }
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      const match = url.pathname.match(/^\\/transaction\\/verify\\/(.+)$/);
      if (match && transactions.has(decodeURIComponent(match[1]))) {
        return new Response(JSON.stringify({ status: true, data: transactions.get(decodeURIComponent(match[1])) }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ status: false, message: 'Unknown mock transaction' }), { status: 404 });
    };
    require('./server.js');
  `;
  const child = spawn(process.execPath, ['-e', mockPaystack], {
    cwd: __dirname,
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: databasePath,
      SESSION_SECRET: 'test-only-session-secret-that-is-long-enough',
      PAYSTACK_SECRET_KEY: paystackSecret,
      PAYSTACK_CALLBACK_URL: 'https://earnchat.example/',
      EARNINGS_ADMIN_SECRET: earningsSecret
    },
    stdio: ['ignore', 'ignore', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill();
      await once(child, 'exit').catch(() => {});
    }
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) assert.fail(`Server exited early: ${stderr}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  assert.equal(ready, true, `Server did not start: ${stderr}`);
  const health = await (await fetch(`${baseUrl}/api/health`)).json();
  assert.equal(health.paymentProvider, 'paystack');
  assert.equal(health.paymentsConfigured, true);
  assert.equal(health.paymentEnvironment, 'test');
  assert.equal(JSON.stringify(health).includes(paystackSecret), false);

  const registration = await fetch(`${baseUrl}/api/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      displayName: 'Test User',
      email: 'test@example.com',
      password: 'a-safe-test-password'
    })
  });
  assert.equal(registration.status, 201);
  const cookie = registration.headers.get('set-cookie').split(';')[0];
  const registered = await registration.json();
  assert.equal(registered.user.earningsBalanceKes, 0);
  assert.equal(registered.user.availableToWithdrawKes, 0);
  assert.equal(registered.user.paidFeesKes, 0);

  const dashboard = await fetch(`${baseUrl}/api/me`, { headers: { cookie } });
  assert.equal(dashboard.status, 200);
  assert.equal((await dashboard.json()).user.verified, false);
  const anonymousDashboard = await fetch(`${baseUrl}/api/me`);
  assert.equal(anonymousDashboard.status, 200);
  assert.equal((await anonymousDashboard.json()).user, null);
  assert.equal((await (await fetch(`${baseUrl}/api/membership`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ plan: 'advanced' })
  })).json()).error, 'Verify your account before choosing a membership plan.');

  const paymentResponse = await fetch(`${baseUrl}/api/payments`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'verification' })
  });
  assert.equal(paymentResponse.status, 202);
  const verificationPayment = await paymentResponse.json();
  assert.equal(verificationPayment.feeAmountKes, 150);
  assert.equal(verificationPayment.checkoutUrl, 'https://checkout.paystack.com/test');

  let testDb = new DatabaseSync(databasePath);
  const secondRegistration = await fetch(`${baseUrl}/api/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      displayName: 'Second User',
      email: 'second@example.com',
      password: 'another-safe-test-password'
    })
  });
  assert.equal(secondRegistration.status, 201);
  const secondCookie = secondRegistration.headers.get('set-cookie').split(';')[0];
  const secondUser = (await secondRegistration.json()).user;
  testDb.prepare('UPDATE users SET verified = 1 WHERE id = ?').run(secondUser.id);
  testDb.close();

  const verificationReturn = await fetch(`${baseUrl}/api/paystack/return?reference=${verificationPayment.paymentId}`, { headers: { cookie } });
  assert.equal(verificationReturn.status, 200);
  assert.equal((await verificationReturn.json()).payment.status, 'paid');

  const membershipResponse = await fetch(`${baseUrl}/api/payments`, {
    method: 'POST',
    headers: { cookie: secondCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'beginner_membership' })
  });
  assert.equal(membershipResponse.status, 202);
  const membershipPayment = await membershipResponse.json();
  const webhookBody = JSON.stringify({
    event: 'charge.success',
    data: { reference: membershipPayment.paymentId, status: 'success' }
  });
  const webhookSignature = crypto.createHmac('sha512', paystackSecret).update(webhookBody).digest('hex');
  const badWebhook = await fetch(`${baseUrl}/api/paystack/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-paystack-signature': 'bad-signature' },
    body: webhookBody
  });
  assert.equal(badWebhook.status, 401);
  const membershipWebhook = await fetch(`${baseUrl}/api/paystack/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-paystack-signature': webhookSignature },
    body: webhookBody
  });
  assert.equal(membershipWebhook.status, 200);

  const afterFees = await (await fetch(`${baseUrl}/api/me`, { headers: { cookie } })).json();
  assert.equal(afterFees.user.verified, true);
  assert.equal(afterFees.user.earningsBalanceKes, 0);
  assert.equal(afterFees.user.paidFeesKes, 150);
  assert.equal(afterFees.user.membershipPlan, null);
  const membershipDashboard = await (await fetch(`${baseUrl}/api/me`, { headers: { cookie: secondCookie } })).json();
  assert.equal(membershipDashboard.user.membershipPlan, 'beginner');
  assert.equal(membershipDashboard.user.membershipFeesKes, 499);

  const untrustedEarning = await fetch(`${baseUrl}/api/internal/eligible-chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: registered.user.id })
  });
  assert.equal(untrustedEarning.status, 401);
  const duplicateVerification = await fetch(`${baseUrl}/api/payments`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'verification' })
  });
  assert.equal(duplicateVerification.status, 409);
  assert.equal((await (await fetch(`${baseUrl}/api/me`, { headers: { cookie } })).json()).user.membershipPlan, null);
  const advancedSelection = await fetch(`${baseUrl}/api/membership`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ plan: 'advanced' })
  });
  assert.equal(advancedSelection.status, 200);
  const event = {
    userId: registered.user.id,
    chatReference: 'verified-chat-0001',
    participantUserIds: [registered.user.id, secondUser.id],
    completedMinutes: 5
  };
  const eventRequest = () => fetch(`${baseUrl}/api/internal/eligible-chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-earnings-admin-secret': earningsSecret },
    body: JSON.stringify(event)
  });
  const shortChat = await fetch(`${baseUrl}/api/internal/eligible-chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-earnings-admin-secret': earningsSecret },
    body: JSON.stringify({ ...event, chatReference: 'short-chat-0001', completedMinutes: 4 })
  });
  assert.equal(shortChat.status, 400);
  const credited = await eventRequest();
  assert.equal(credited.status, 201);
  assert.equal((await credited.json()).amountKes, 1300);
  assert.equal((await eventRequest()).status, 409);
  const premiumSelection = await fetch(`${baseUrl}/api/membership`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ plan: 'premium' })
  });
  assert.equal(premiumSelection.status, 200);
  const premiumCredit = await fetch(`${baseUrl}/api/internal/eligible-chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-earnings-admin-secret': earningsSecret },
    body: JSON.stringify({ ...event, chatReference: 'verified-chat-0002' })
  });
  assert.equal(premiumCredit.status, 201);
  assert.equal((await premiumCredit.json()).amountKes, 2500);
  const afterEarnings = await (await fetch(`${baseUrl}/api/me`, { headers: { cookie } })).json();
  assert.equal(afterEarnings.user.earningsBalanceKes, 3800);
  assert.equal(afterEarnings.user.paidFeesKes, 150);

  const disabledFeePayment = await fetch(`${baseUrl}/api/payments`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'withdrawal_fee' })
  });
  assert.equal(disabledFeePayment.status, 503);
  assert.match((await disabledFeePayment.json()).error, /disabled until an authorized payout service/);

  const belowMinimum = await fetch(`${baseUrl}/api/withdrawals`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ amountKes: 3499 })
  });
  assert.equal(belowMinimum.status, 400);
  assert.match((await belowMinimum.json()).error, /minimum withdrawal is KSh 3500/);
  const unavailablePayout = await fetch(`${baseUrl}/api/withdrawals`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ amountKes: 3500 })
  });
  assert.equal(unavailablePayout.status, 503);
  assert.match((await unavailablePayout.json()).error, /No fee has been charged/);

  const login = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: 'a-safe-test-password' })
  });
  assert.equal(login.status, 200);
  assert.equal((await login.json()).user.earningsBalanceKes, 3800);
});
