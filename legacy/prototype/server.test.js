const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { once } = require('node:events');
const test = require('node:test');

test('M-Pesa STK payments use fixed prices and confirmed fees never become earnings', async (t) => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'earnchat-test-'));
  const port = 32000 + Math.floor(Math.random() * 20000);
  const databasePath = path.join(tempDirectory, 'test.sqlite');
  const earningsSecret = 'test-only-earnings-secret-that-is-long-enough';
  const darajaKey = 'daraja-test-consumer-key';
  const darajaSecret = 'daraja-test-consumer-secret';
  const mockDaraja = [
    'const checkouts = new Map();',
    'global.fetch = async (input, options = {}) => {',
    '  const url = new URL(input);',
    "  if (url.hostname !== 'sandbox.safaricom.co.ke') throw new Error('Unexpected external request in test');",
    "  if (url.pathname === '/oauth/v1/generate') {",
    "    const expected = 'Basic ' + Buffer.from(process.env.MPESA_CONSUMER_KEY + ':' + process.env.MPESA_CONSUMER_SECRET).toString('base64');",
    "    if (options.headers.authorization !== expected) throw new Error('Missing Daraja consumer credentials');",
    "    return new Response(JSON.stringify({ access_token: 'daraja-test-token', expires_in: '3599' }), { status: 200, headers: { 'content-type': 'application/json' } });",
    '  }',
    "  if (options.headers.authorization !== 'Bearer daraja-test-token') throw new Error('Missing Daraja access token');",
    "  if (url.pathname === '/mpesa/stkpush/v1/processrequest') {",
    '    const request = JSON.parse(options.body);',
    "    if (request.BusinessShortCode !== process.env.MPESA_SHORTCODE || request.AccountReference !== 'EARNCHAT') throw new Error('Unexpected Paybill details');",
    "    if (!/^254[17][0-9]{8}$/.test(request.PhoneNumber)) throw new Error('Phone was not normalized');",
    "    const checkoutRequestId = 'checkout-' + request.TransactionDesc;",
    '    checkouts.set(checkoutRequestId, request);',
    "    return new Response(JSON.stringify({ ResponseCode: '0', MerchantRequestID: 'merchant-' + request.TransactionDesc, CheckoutRequestID: checkoutRequestId }), { status: 200, headers: { 'content-type': 'application/json' } });",
    '  }',
    "  if (url.pathname === '/mpesa/stkpushquery/v1/query') {",
    '    const request = JSON.parse(options.body);',
    '    const found = checkouts.has(request.CheckoutRequestID);',
    "    return new Response(JSON.stringify(found ? { ResultCode: '0', CheckoutRequestID: request.CheckoutRequestID } : { ResultCode: '1' }), { status: 200, headers: { 'content-type': 'application/json' } });",
    '  }',
    "  return new Response(JSON.stringify({ errorMessage: 'Unknown mock transaction' }), { status: 404 });",
    '};',
    "require('./server.js');"
  ].join('\n');
  const child = spawn(process.execPath, ['-e', mockDaraja], {
    cwd: __dirname,
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: databasePath,
      SESSION_SECRET: 'test-only-session-secret-that-is-long-enough',
      MPESA_ENVIRONMENT: 'sandbox',
      MPESA_CONSUMER_KEY: darajaKey,
      MPESA_CONSUMER_SECRET: darajaSecret,
      MPESA_SHORTCODE: '542542',
      MPESA_PASSKEY: 'daraja-test-passkey',
      MPESA_CALLBACK_URL: 'https://earnchat.example/api/mpesa/callback',
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
      if (response.ok) { ready = true; break; }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  assert.equal(ready, true, `Server did not start: ${stderr}`);
  const health = await (await fetch(`${baseUrl}/api/health`)).json();
  assert.equal(health.paymentProvider, 'safaricom_mpesa');
  assert.equal(health.paymentsConfigured, true);
  assert.equal(health.paymentEnvironment, 'sandbox');
  assert.equal(JSON.stringify(health).includes(darajaSecret), false);

  const registration = await fetch(`${baseUrl}/api/register`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ displayName: 'Test User', email: 'test@example.com', password: 'a-safe-test-password' })
  });
  assert.equal(registration.status, 201);
  const cookie = registration.headers.get('set-cookie').split(';')[0];
  const registered = await registration.json();
  assert.equal(registered.user.earningsBalanceKes, 0);
  assert.equal(registered.user.availableToWithdrawKes, 0);
  assert.equal(registered.user.paidFeesKes, 0);
  assert.equal((await (await fetch(`${baseUrl}/api/me`, { headers: { cookie } })).json()).user.verified, false);
  assert.equal((await (await fetch(`${baseUrl}/api/me`)).json()).user, null);
  assert.equal((await (await fetch(`${baseUrl}/api/membership`, {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ plan: 'advanced' })
  })).json()).error, 'Verify your account before choosing a membership plan.');
  const invalidPhone = await fetch(`${baseUrl}/api/payments`, {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'verification', phone: '12345' })
  });
  assert.equal(invalidPhone.status, 400);

  const paymentResponse = await fetch(`${baseUrl}/api/payments`, {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'verification', phone: '0712 345 678', amountKes: 1 })
  });
  assert.equal(paymentResponse.status, 202);
  const verificationPayment = await paymentResponse.json();
  assert.equal(verificationPayment.feeAmountKes, 150);
  assert.match(verificationPayment.message, /official M-Pesa prompt/);
  let testDb = new DatabaseSync(databasePath);
  const verificationRow = testDb.prepare('SELECT * FROM fee_payments WHERE id = ?').get(verificationPayment.paymentId);
  assert.equal(verificationRow.amount_kes, 150);
  assert.equal(verificationRow.phone, '254712345678');
  assert.ok(verificationRow.checkout_request_id);

  const secondRegistration = await fetch(`${baseUrl}/api/register`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ displayName: 'Second User', email: 'second@example.com', password: 'another-safe-test-password' })
  });
  assert.equal(secondRegistration.status, 201);
  const secondCookie = secondRegistration.headers.get('set-cookie').split(';')[0];
  const secondUser = (await secondRegistration.json()).user;
  testDb.prepare('UPDATE users SET verified = 1 WHERE id = ?').run(secondUser.id);
  testDb.close();

  const callbackFor = (checkoutRequestId, amount, phone, receipt, resultCode = 0) => ({
    Body: { stkCallback: {
      CheckoutRequestID: checkoutRequestId,
      MerchantRequestID: 'merchant-test',
      ResultCode: resultCode,
      ResultDesc: 'The service request is processed successfully.',
      CallbackMetadata: { Item: [
        { Name: 'Amount', Value: amount },
        { Name: 'MpesaReceiptNumber', Value: receipt },
        { Name: 'PhoneNumber', Value: Number(phone) }
      ] }
    } }
  });
  const callbackUrl = `${baseUrl}/api/mpesa/callback`;
  const wrongAmountCallback = await fetch(callbackUrl, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(callbackFor(verificationRow.checkout_request_id, 149, '254712345678', 'TEST123'))
  });
  assert.equal(wrongAmountCallback.status, 200);
  const stillPending = await (await fetch(`${baseUrl}/api/payments/${verificationPayment.paymentId}`, { headers: { cookie } })).json();
  assert.equal(stillPending.payment.status, 'pending');
  const wrongPhoneCallback = await fetch(callbackUrl, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(callbackFor(verificationRow.checkout_request_id, 150, '254700000001', 'TEST123'))
  });
  assert.equal(wrongPhoneCallback.status, 200);
  const failedCallback = await fetch(callbackUrl, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(callbackFor(verificationRow.checkout_request_id, 150, '254712345678', 'TEST123', 1032))
  });
  assert.equal(failedCallback.status, 200);
  const notConfirmed = await (await fetch(`${baseUrl}/api/payments/${verificationPayment.paymentId}`, { headers: { cookie } })).json();
  assert.equal(notConfirmed.payment.status, 'pending');
  const verifiedCallback = await fetch(callbackUrl, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(callbackFor(verificationRow.checkout_request_id, 150, '254712345678', 'TEST123'))
  });
  assert.equal(verifiedCallback.status, 200);
  const confirmedPayment = await (await fetch(`${baseUrl}/api/payments/${verificationPayment.paymentId}`, { headers: { cookie } })).json();
  assert.equal(confirmedPayment.payment.status, 'paid');
  const afterFees = await (await fetch(`${baseUrl}/api/me`, { headers: { cookie } })).json();
  assert.equal(afterFees.user.verified, true);
  assert.equal(afterFees.user.earningsBalanceKes, 0);
  assert.equal(afterFees.user.paidFeesKes, 150);
  assert.equal(afterFees.user.membershipPlan, null);

  const membershipResponse = await fetch(`${baseUrl}/api/payments`, {
    method: 'POST', headers: { cookie: secondCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'beginner_membership', phone: '254712345678' })
  });
  assert.equal(membershipResponse.status, 202);
  const membershipPayment = await membershipResponse.json();
  assert.equal(membershipPayment.feeAmountKes, 499);
  testDb = new DatabaseSync(databasePath);
  const membershipRow = testDb.prepare('SELECT * FROM membership_payments WHERE id = ?').get(membershipPayment.paymentId);
  assert.equal(membershipRow.amount_kes, 499);
  testDb.close();
  const membershipCallback = await fetch(callbackUrl, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(callbackFor(membershipRow.checkout_request_id, 499, '254712345678', 'TEST499'))
  });
  assert.equal(membershipCallback.status, 200);
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
    body: JSON.stringify({ kind: 'verification', phone: '0712345678' })
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
    body: JSON.stringify({ kind: 'withdrawal_fee', phone: '0712345678' })
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
