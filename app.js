const toast = document.getElementById('toast');
const accountModal = document.getElementById('accountModal');
const profileModal = document.getElementById('profileModal');
const paymentModal = document.getElementById('paymentModal');
const withdrawalModal = document.getElementById('withdrawalModal');
const STORAGE_KEY = 'earnchat-state-v1';

const people = {
  'Maya Chen': { avatar: 'avatar-maya', initials: 'MC', topic: 'Portland, OR', opening: 'Hey Alex! I saw you’re into weekend hikes. I’m planning a trip out to the coast soon.' },
  'Jon Bell': { avatar: 'avatar-jon', initials: 'JB', topic: 'Austin, TX', opening: 'Hey Alex, thanks for picking up. What have you been listening to lately?' },
  'Priya Shah': { avatar: 'avatar-priya', initials: 'PS', topic: 'London, UK', opening: 'Hi! I’m taking a break from work and would love a little company.' },
  'Eli Santos': { avatar: 'avatar-eli', initials: 'ES', topic: 'Toronto, CA', opening: 'Hey Alex! How did your interview go?' }
};

const defaultMessages = {
  'Maya Chen': [
    { direction: 'incoming', text: 'Hey Alex! I saw you’re into weekend hikes. I’m planning a trip out to the coast soon.', time: '10:36 AM' },
    { direction: 'outgoing', text: 'That sounds like a plan! Have you ever tried the trails around Cape Lookout?', time: '10:38 AM', read: '✓✓' },
    { direction: 'incoming', text: 'Not yet, but it’s officially on the list. I’m a little intimidated by the distance though!', time: '10:42 AM' }
  ],
  'Jon Bell': [
    { direction: 'incoming', text: 'Hey Alex, thanks for picking up. What have you been listening to lately?', time: 'Yesterday' },
    { direction: 'outgoing', text: 'I’ve been cycling through a lot of mellow indie and jazz lately.', time: 'Yesterday', read: '✓✓' }
  ],
  'Priya Shah': [
    { direction: 'incoming', text: 'Hi! I’m taking a break from work and would love a little company.', time: 'Sun' },
    { direction: 'outgoing', text: 'That sounds perfect. I could use a little reset too.', time: 'Sun', read: '✓' }
  ],
  'Eli Santos': [
    { direction: 'incoming', text: 'Hey Alex! How did your interview go?', time: 'Sat' },
    { direction: 'outgoing', text: 'It went really well — I’m excited to keep moving forward.', time: 'Sat', read: '✓✓' }
  ]
};

function loadConversations() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return JSON.parse(JSON.stringify(defaultMessages));

  try {
    const parsed = JSON.parse(saved);
    return Object.keys(people).reduce((result, name) => {
      result[name] = Array.isArray(parsed[name]) && parsed[name].length ? parsed[name] : JSON.parse(JSON.stringify(defaultMessages[name]));
      return result;
    }, {});
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    showToast('Saved demo conversations could not be read. Starting with sample chats.');
    return JSON.parse(JSON.stringify(defaultMessages));
  }
}

const state = {
  selectedPerson: 'Maya Chen',
  conversations: loadConversations(),
  account: null,
  walletBalance: 0,
  availableToWithdraw: 0,
  paidFees: { verification: 0, withdrawal_fee: 0 },
  pendingPaymentId: null,
  paymentKind: 'verification'
};

function persistConversations() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.conversations));
}

async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...options.headers
      }
    });
  } catch (error) {
    throw new Error('Could not reach the EarnChat server. Start it with npm start and open http://localhost:3000.');
  }
  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error('The EarnChat server returned an invalid response.');
  }
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove('show'), 2600);
}

function toggleModal(modal, open) {
  modal.classList.toggle('open', open);
  modal.setAttribute('aria-hidden', String(!open));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function formatKsh(amount) {
  return `KSh ${Math.round(amount).toLocaleString('en-KE')}`;
}

function updateCurrentDate() {
  document.getElementById('todayLabel').textContent = new Intl.DateTimeFormat('en-KE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date());
}

function configurePaymentModal(kind) {
  state.paymentKind = kind;
  const beginner = kind === 'beginner_membership';
  document.getElementById('paymentEyebrow').textContent = beginner ? 'IntaSend membership checkout' : 'IntaSend verification checkout';
  document.getElementById('paymentTitle').innerHTML = beginner ? 'Choose your<br /><em>membership.</em>' : 'Activate your<br /><em>account.</em>';
  document.getElementById('paymentDescription').textContent = beginner
    ? 'Continue to IntaSend to pay KSh 499 for the Beginner plan. Membership activates only after the server verifies successful payment.'
    : 'Continue to IntaSend for secure payment. Your account is verified only after the server verifies successful payment.';
  document.getElementById('paymentFeeLabel').textContent = beginner ? 'Beginner membership fee' : 'Verification fee';
  document.getElementById('paymentAmount').textContent = formatKsh(beginner ? 499 : 150);
  document.getElementById('requestPayment').innerHTML = `Continue to IntaSend <span>→</span>`;
  document.getElementById('paymentCustomer').textContent = `IntaSend checkout will use your account email: ${state.account?.email || ''}`;
}

function updateAccountUI() {
  document.querySelector('#profileModal .activation-box small').textContent =
    'One-time KSh 150 IntaSend payment. Status updates only after provider confirmation.';
  if (!state.account) {
    document.getElementById('profileDisplayName').textContent = 'Sign in';
    document.getElementById('accountDisplayName').textContent = 'Sign in';
    document.getElementById('accountAvatar').textContent = 'EC';
    document.getElementById('profileName').value = '';
    document.getElementById('verificationStatus').textContent = 'Pending';
    document.getElementById('activateButton').innerHTML = 'Save details &amp; continue <span>→</span>';
    document.getElementById('activateButton').disabled = false;
    document.getElementById('withdrawButton').textContent = 'Sign in to withdraw →';
    document.getElementById('verificationFees').textContent = formatKsh(0);
    document.getElementById('withdrawalFees').textContent = formatKsh(0);
    document.getElementById('membershipFees').textContent = formatKsh(0);
    document.getElementById('membershipStatus').textContent = 'Sign in to choose a plan';
    document.querySelectorAll('.plan-action').forEach((button) => {
      button.disabled = false;
      button.textContent = 'Choose';
    });
    document.getElementById('availableBalance').textContent = `Available to withdraw: ${formatKsh(0)}`;
    document.getElementById('walletNotice').textContent = 'Sign in to see server-recorded earnings. Fees are tracked separately.';
    return;
  }
  const name = state.account.displayName;
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  document.getElementById('profileDisplayName').textContent = name;
  document.getElementById('accountDisplayName').textContent = name;
  document.getElementById('accountAvatar').textContent = initials || 'EC';
  document.getElementById('profileName').value = name;
  document.getElementById('verificationStatus').textContent = state.account.verified ? 'Verified' : 'Pending';
  document.getElementById('activateButton').innerHTML = state.account.verified
    ? 'Account verified <span>✓</span>'
    : 'Save details &amp; continue <span>→</span>';
  document.getElementById('activateButton').disabled = state.account.verified;
  document.getElementById('withdrawButton').textContent = state.account.verified
    ? 'Withdraw earnings →'
    : 'Verify to withdraw →';
  document.getElementById('verificationFees').textContent = formatKsh(state.paidFees.verification);
  document.getElementById('withdrawalFees').textContent = formatKsh(state.paidFees.withdrawal_fee);
  document.getElementById('membershipFees').textContent = formatKsh(state.account.membershipFeesKes || 0);
  document.getElementById('membershipStatus').textContent = state.account.membershipPlan
    ? `${state.account.membershipPlan[0].toUpperCase()}${state.account.membershipPlan.slice(1)} plan active`
    : state.account.verified ? 'No active plan' : 'Verify before choosing a plan';
  document.querySelectorAll('.plan-action').forEach((button) => {
    const plan = button.dataset.plan;
    button.disabled = !state.account.verified || state.account.membershipPlan === 'beginner' || state.account.membershipPlan === plan;
    button.textContent = state.account.membershipPlan === plan ? 'Active' : 'Choose';
  });
  document.getElementById('availableBalance').textContent = `Available to withdraw: ${formatKsh(state.availableToWithdraw)}`;
  document.getElementById('walletNotice').textContent = 'Earnings and paid fees are maintained in separate server records.';
}

function updateWalletUI() {
  document.getElementById('walletBalance').textContent = formatKsh(state.walletBalance);
}

function setUser(user) {
  state.account = user ? {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    verified: user.verified,
    membershipPlan: user.membershipPlan,
    membershipFeesKes: user.membershipFeesKes || 0
  } : null;
  state.walletBalance = user?.earningsBalanceKes || 0;
  state.availableToWithdraw = user?.availableToWithdrawKes || 0;
  state.paidFees = {
    verification: user?.paidFeesByKind?.verification || 0,
    withdrawal_fee: user?.paidFeesByKind?.withdrawal_fee || 0
  };
  updateAccountUI();
  updateWalletUI();
}

async function refreshSession() {
  try {
    const { user } = await apiRequest('/api/me');
    if (!user) {
      setUser(null);
      return;
    }
    setUser(user);
  } catch (error) {
    setUser(null);
    showToast(error.message);
  }
}

async function refreshPaymentReadiness() {
  const status = document.getElementById('paymentReadiness');
  try {
    const health = await apiRequest('/api/health');
    if (!health.paymentsConfigured) {
      status.textContent = 'Payments are not connected yet. Add your IntaSend keys, webhook challenge, and public callback URL to the server.';
      status.dataset.state = 'unconfigured';
      return;
    }
    const environment = health.paymentEnvironment === 'test' ? 'Test key detected'
      : health.paymentEnvironment === 'live' ? 'Live key detected'
        : 'Payment key detected';
    status.textContent = `${environment}. Confirm your IntaSend account is active and the required payment methods are enabled before accepting payments.`;
    status.dataset.state = health.paymentEnvironment === 'live' ? 'live-key' : 'configured';
  } catch (error) {
    status.textContent = `Could not check payment setup: ${error.message}`;
    status.dataset.state = 'error';
  }
}

async function pollPayment(paymentId, attempts = 0) {
  if (attempts >= 40) {
    state.pendingPaymentId = null;
    showToast('Payment is still processing. Check your dashboard again shortly before retrying.');
    return;
  }
  await new Promise((resolve) => window.setTimeout(resolve, 3000));
  try {
    const { payment } = await apiRequest(`/api/payments/${encodeURIComponent(paymentId)}`);
    if (payment.status === 'paid') {
      state.pendingPaymentId = null;
      await refreshSession();
      toggleModal(paymentModal, false);
      showToast(payment.kind === 'verification'
        ? 'IntaSend confirmed payment. Your account is verified.'
        : 'IntaSend confirmed payment. Your Beginner membership is active.');
      return;
    }
    if (payment.status === 'failed' || payment.status === 'initiation_failed') {
      state.pendingPaymentId = null;
      await refreshSession();
      toggleModal(paymentModal, false);
      showToast('IntaSend payment was not completed. No fee was marked as paid.');
      return;
    }
    await pollPayment(paymentId, attempts + 1);
  } catch (error) {
    state.pendingPaymentId = null;
    showToast(`Could not check payment status: ${error.message}`);
  }
}

async function handleIntaSendReturn() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('payment') !== 'intasend') return;
  const paymentId = params.get('payment_id') || '';
  window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`);
  if (!paymentId) {
    showToast('IntaSend returned without a payment reference. Check your dashboard before retrying.');
    return;
  }
  try {
    const { payment } = await apiRequest(`/api/intasend/return?payment_id=${encodeURIComponent(paymentId)}`);
    if (payment.status === 'paid') {
      await refreshSession();
      showToast(payment.kind === 'verification'
        ? 'IntaSend confirmed payment. Your account is verified.'
        : 'IntaSend confirmed payment. Your Beginner membership is active.');
    } else if (payment.status === 'failed' || payment.status === 'initiation_failed') {
      showToast('IntaSend payment was not completed. No fee was marked as paid.');
    } else {
      state.pendingPaymentId = payment.id;
      showToast('Payment is still processing. We will check the verified transaction status.');
      pollPayment(payment.id);
    }
  } catch (error) {
    showToast(`Could not confirm IntaSend payment: ${error.message}`);
  }
}

function setAuthMode(mode) {
  const isSignup = mode === 'signup';
  document.getElementById('authTitle').innerHTML = isSignup ? 'Create your<br /><em>account.</em>' : 'Welcome<br /><em>back.</em>';
  document.getElementById('authDescription').textContent = isSignup
    ? 'Create your EarnChat account to open your dashboard.'
    : 'Sign in to your EarnChat dashboard.';
  document.getElementById('authNameField').hidden = !isSignup;
  document.getElementById('authName').required = isSignup;
  document.getElementById('authPassword').autocomplete = isSignup ? 'new-password' : 'current-password';
  document.getElementById('modalSubmit').innerHTML = isSignup ? 'Create account <span>→</span>' : 'Sign in <span>→</span>';
  document.getElementById('authSwitchText').textContent = isSignup ? 'Already registered?' : 'New here?';
  document.getElementById('authSwitch').textContent = isSignup ? 'Sign in' : 'Create an account';
  document.getElementById('authForm').dataset.mode = mode;
  document.getElementById('logoutButton').hidden = !state.account;
  document.getElementById('authPassword').value = '';
}

function getLastMessage(name) {
  const messages = state.conversations[name]?.messages ?? state.conversations[name] ?? [];
  return messages[messages.length - 1] || { text: people[name]?.opening || '', time: 'Now' };
}

function buildReply(name, value) {
  const replyBank = {
    'Maya Chen': [
      'That sounds like a beautiful plan — I’m in.',
      'I’m definitely curious about that spot. Tell me more.',
      'That feels like the kind of weekend I need right now.'
    ],
    'Jon Bell': [
      'That sounds like the perfect playlist for the drive.',
      'I’ve been hearing that same recommendation a lot lately.',
      'Nice — I’m definitely adding that to my queue.'
    ],
    'Priya Shah': [
      'That sounds like exactly the kind of reset I need.',
      'A slow afternoon sounds lovely right now.',
      'I can picture it already. Let’s make it happen.'
    ],
    'Eli Santos': [
      'That’s amazing news — congrats again.',
      'You’re definitely moving in the right direction.',
      'I’m glad it went well. You earned that.'
    ]
  };

  const options = replyBank[name] || ['That sounds great — let’s do it.'];
  const fallbackText = value.length > 40 ? value.slice(0, 40) + '…' : value;
  return options[Math.floor(Math.random() * options.length)] + ` (${fallbackText})`;
}

function updateConversationPreview() {
  const conversationRows = document.querySelectorAll('.conversation-row');
  const miniChats = document.querySelectorAll('.mini-chat');

  [...conversationRows, ...miniChats].forEach((item) => {
    const name = item.dataset.person;
    const conv = state.conversations[name] || [];
    const lastMessage = getLastMessage(name);
    const preview = (lastMessage.text || people[name]?.opening || '').replace(/\s+/g, ' ').trim();
    const shortPreview = preview.length > 42 ? `${preview.slice(0, 42)}…` : preview;

    if (item.classList.contains('mini-chat')) {
      const copy = item.querySelector('.mini-copy small');
      if (copy) copy.textContent = shortPreview;
      item.classList.toggle('selected', name === state.selectedPerson);
      return;
    }

    const content = item.querySelector('.row-content small');
    const time = item.querySelector('.row-time small');
    const badge = item.querySelector('.row-time b');

    if (content) content.textContent = shortPreview;
    if (time) time.textContent = lastMessage.time || 'Now';
    if (badge && name === 'Maya Chen') badge.textContent = '2';

    item.classList.toggle('active', name === state.selectedPerson);
    item.hidden = false;
  });
}

function renderChat(name) {
  const selectedName = name || state.selectedPerson;
  const person = people[selectedName] || people['Maya Chen'];
  const messages = state.conversations[selectedName] || [];
  const conversation = messages.length ? messages : [{ direction: 'incoming', text: person.opening, time: 'Now' }];
  const body = document.getElementById('chatBody');
  document.getElementById('chatName').textContent = selectedName;
  document.getElementById('chatTopic').textContent = person.topic;

  const chatAvatar = document.querySelector('.chat-person .avatar');
  if (chatAvatar) {
    chatAvatar.className = `avatar ${person.avatar}`;
    chatAvatar.textContent = person.initials;
  }

  const html = conversation.map((message) => {
    const bubbleClass = message.direction === 'outgoing' ? 'message-row outgoing' : 'message-row incoming';
    const avatarMarkup = message.direction === 'incoming'
      ? `<span class="avatar ${person.avatar} small">${person.initials}</span>`
      : '';
    const safeTime = escapeHtml(message.time || 'Now');
    const readMarkup = message.read ? ` <span class="read-mark">${escapeHtml(message.read)}</span>` : '';
    const timeMarkup = `<time>${safeTime}${readMarkup}</time>`;

    return `
      <div class="${bubbleClass}">
        ${avatarMarkup}
        <div>
          <div class="bubble">${escapeHtml(message.text)}</div>
          ${timeMarkup}
        </div>
      </div>
    `;
  }).join('');

  body.innerHTML = `<div class="date-divider"><span>Today</span></div>${html}<div class="typing"><span class="avatar ${person.avatar} small">${person.initials}</span><span class="typing-text"><i></i><i></i><i></i></span><small>${selectedName.split(' ')[0]} is typing...</small></div>`;
  body.scrollTop = body.scrollHeight;
}

function setActivePerson(name) {
  const safeName = people[name] ? name : 'Maya Chen';
  state.selectedPerson = safeName;
  document.querySelectorAll('[data-person]').forEach((item) => {
    const matches = item.dataset.person === safeName;
    item.classList.toggle('active', item.classList.contains('conversation-row') && matches);
    item.classList.toggle('selected', item.classList.contains('mini-chat') && matches);
  });
  renderChat(safeName);
  updateConversationPreview();
}

function persistStateAfterSend() {
  persistConversations();
  updateConversationPreview();
}

function handleSendMessage(value) {
  const selectedName = state.selectedPerson;
  if (!state.conversations[selectedName]) state.conversations[selectedName] = [];
  state.conversations[selectedName].push({
    direction: 'outgoing',
    text: value,
    time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    read: '✓'
  });
  persistStateAfterSend();
  renderChat(selectedName);

  window.setTimeout(() => {
    if (state.selectedPerson !== selectedName) return;
    state.conversations[selectedName].push({
      direction: 'incoming',
      text: buildReply(selectedName, value),
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    });
    persistStateAfterSend();
    renderChat(selectedName);
  }, 850);
}

document.getElementById('openAccount').addEventListener('click', () => {
  setAuthMode('login');
  toggleModal(accountModal, true);
});
document.getElementById('closeAccount').addEventListener('click', () => {
  toggleModal(accountModal, false);
});
accountModal.addEventListener('click', (event) => {
  if (event.target === accountModal) document.getElementById('closeAccount').click();
});
document.getElementById('authSwitch').addEventListener('click', () => {
  setAuthMode(document.getElementById('authForm').dataset.mode === 'signup' ? 'login' : 'signup');
});
document.getElementById('authForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const mode = form.dataset.mode;
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const payload = { email, password };
  const endpoint = mode === 'signup' ? '/api/register' : '/api/login';
  if (mode === 'signup') payload.displayName = document.getElementById('authName').value.trim();

  apiRequest(endpoint, { method: 'POST', body: JSON.stringify(payload) })
    .then(({ user }) => {
      setUser(user);
      toggleModal(accountModal, false);
      form.reset();
      showToast(mode === 'signup' ? 'Account created. Complete verification to continue.' : `Welcome back, ${user.displayName}.`);
    })
    .catch((error) => showToast(error.message));
});
document.getElementById('logoutButton').addEventListener('click', () => {
  apiRequest('/api/logout', { method: 'POST', body: '{}' })
    .then(() => {
      setUser(null);
      toggleModal(accountModal, false);
      showToast('You are signed out.');
    })
    .catch((error) => showToast(error.message));
});

document.getElementById('openProfile').addEventListener('click', () => toggleModal(profileModal, true));
document.getElementById('profileNav').addEventListener('click', () => toggleModal(profileModal, true));
document.getElementById('closeProfile').addEventListener('click', () => toggleModal(profileModal, false));
document.getElementById('closePayment').addEventListener('click', () => toggleModal(paymentModal, false));
document.getElementById('closeWithdrawal').addEventListener('click', () => toggleModal(withdrawalModal, false));
[profileModal, paymentModal, withdrawalModal].forEach((modal) => modal.addEventListener('click', (event) => {
  if (event.target === modal) toggleModal(modal, false);
}));

document.getElementById('activateButton').addEventListener('click', () => {
  const age = Number(document.getElementById('profileAge').value);
  if (!document.getElementById('profileName').value.trim() || age < 18) {
    showToast('Add your name and confirm you are 18 or older.');
    return;
  }
  if (!state.account) {
    toggleModal(profileModal, false);
    setAuthMode('signup');
    toggleModal(accountModal, true);
    showToast('Create an account or sign in before verification.');
    return;
  }
  apiRequest('/api/profile', {
    method: 'POST',
    body: JSON.stringify({ displayName: document.getElementById('profileName').value.trim() })
  }).then(({ user }) => {
    setUser(user);
    toggleModal(profileModal, false);
    if (!state.account.verified) {
      configurePaymentModal('verification');
      toggleModal(paymentModal, true);
    }
  }).catch((error) => showToast(error.message));
});

document.getElementById('requestPayment').addEventListener('click', () => {
  if (state.pendingPaymentId) {
    showToast('A payment request is already pending. Complete checkout or wait for its status.');
    return;
  }
  if (!state.account) {
    showToast('Sign in or create an account before verification.');
    toggleModal(paymentModal, false);
    setAuthMode('signup');
    toggleModal(accountModal, true);
    return;
  }
  const button = document.getElementById('requestPayment');
  button.disabled = true;
  apiRequest('/api/payments', {
    method: 'POST',
    body: JSON.stringify({ kind: state.paymentKind })
  }).then(({ checkoutUrl }) => {
    if (!checkoutUrl) throw new Error('IntaSend did not return a checkout URL.');
    window.location.assign(checkoutUrl);
  }).catch((error) => {
    showToast(error.message);
  }).finally(() => {
    button.disabled = false;
  });
});

document.querySelectorAll('.plan-action').forEach((button) => {
  button.addEventListener('click', () => {
    if (!state.account) {
      setAuthMode('login');
      toggleModal(accountModal, true);
      showToast('Sign in or create an account to choose a membership plan.');
      return;
    }
    if (!state.account.verified) {
      toggleModal(profileModal, true);
      showToast('Verify your account before choosing a membership plan.');
      return;
    }
    if (button.dataset.plan === 'beginner') {
      configurePaymentModal('beginner_membership');
      toggleModal(paymentModal, true);
      return;
    }
    apiRequest('/api/membership', {
      method: 'POST',
      body: JSON.stringify({ plan: button.dataset.plan })
    }).then(({ user }) => {
      setUser(user);
      showToast(`${button.dataset.plan[0].toUpperCase()}${button.dataset.plan.slice(1)} plan selected.`);
    }).catch((error) => showToast(error.message));
  });
});

document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((nav) => nav.classList.remove('active'));
    item.classList.add('active');
    if (item.dataset.view !== 'Inbox') showToast(`${item.dataset.view} is coming into focus.`);
  });
});

document.querySelectorAll('[data-person]').forEach((item) => {
  item.addEventListener('click', () => setActivePerson(item.dataset.person));
});

document.getElementById('messageForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = document.getElementById('messageInput');
  const value = input.value.trim();
  if (!value) return;
  handleSendMessage(value);
  input.value = '';
  showToast('Message sent · chat earnings are not enabled yet');
});

document.getElementById('searchInput').addEventListener('input', (event) => {
  const query = event.target.value.toLowerCase().trim();
  const isBlank = !query;

  document.querySelectorAll('.conversation-row, .mini-chat').forEach((item) => {
    const name = item.dataset.person || '';
    const text = (item.textContent || '').toLowerCase();
    item.hidden = !isBlank && !text.includes(query);
  });
});

document.getElementById('newChat').addEventListener('click', () => {
  const order = ['Maya Chen', 'Jon Bell', 'Priya Shah', 'Eli Santos'];
  const currentIndex = order.indexOf(state.selectedPerson);
  const nextPerson = order[(currentIndex + 1) % order.length];
  setActivePerson(nextPerson);
  showToast(`Starting a fresh chat with ${nextPerson}.`);
});

document.getElementById('withdrawButton').addEventListener('click', () => {
  if (!state.account) {
    setAuthMode('login');
    toggleModal(accountModal, true);
    showToast('Sign in or create an account to manage your wallet.');
    return;
  }
  if (!state.account.verified) {
    toggleModal(profileModal, true);
    showToast('Verify your account before requesting a withdrawal.');
    return;
  }
  if (state.availableToWithdraw <= 0) {
    showToast('There is no server-recorded earned balance available to withdraw yet.');
    return;
  }
  if (state.availableToWithdraw < 3500) {
    showToast('Your eligible available earnings must reach KSh 3,500 before withdrawal.');
    return;
  }
  document.getElementById('withdrawalAmount').max = String(state.availableToWithdraw);
  document.getElementById('withdrawalAmount').value = String(Math.min(3500, state.availableToWithdraw));
  document.getElementById('withdrawalAmountSummary').textContent = formatKsh(Math.min(3500, state.availableToWithdraw));
  toggleModal(withdrawalModal, true);
});
document.getElementById('withdrawalAmount').addEventListener('input', (event) => {
  const amount = Number(event.target.value);
  document.getElementById('withdrawalAmountSummary').textContent = Number.isFinite(amount) && amount > 0
    ? formatKsh(amount)
    : 'KSh 0';
});
document.getElementById('requestWithdrawal').addEventListener('click', () => {
  const amount = Number(document.getElementById('withdrawalAmount').value);
  if (!Number.isSafeInteger(amount) || amount < 3500 || amount > state.availableToWithdraw) {
    showToast(`Enter at least KSh 3,500 and no more than your available earned balance of ${formatKsh(state.availableToWithdraw)}.`);
    return;
  }

  const button = document.getElementById('requestWithdrawal');
  button.disabled = true;
  apiRequest('/api/withdrawals', {
    method: 'POST',
    body: JSON.stringify({ amountKes: amount })
  }).then(() => {
    showToast('Withdrawal request submitted.');
  }).catch((error) => showToast(error.message))
    .finally(() => { button.disabled = false; });
});
document.querySelectorAll('.copy-payment-detail').forEach((button) => {
  button.addEventListener('click', async () => {
    const value = button.dataset.copy;
    try {
      await navigator.clipboard.writeText(value);
      showToast(`${value} copied.`);
    } catch (error) {
      showToast(`Copy this number manually: ${value}`);
    }
  });
});
setActivePerson('Maya Chen');
updateCurrentDate();
updateConversationPreview();
updateWalletUI();
setAuthMode('login');
refreshSession();
refreshPaymentReadiness();
handleIntaSendReturn();
