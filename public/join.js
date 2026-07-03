// ═══════════════════════════════════════════════════════════
// YGO SKYSCRAPER — JOIN.JS
// Handles the invite-link account setup flow.
// ═══════════════════════════════════════════════════════════

injectNav(null);

const params = new URLSearchParams(window.location.search);
const inviteToken = params.get('token');

const loadingEl  = document.getElementById('join-loading');
const invalidEl  = document.getElementById('join-invalid');
const invalidMsg = document.getElementById('join-invalid-msg');
const formEl     = document.getElementById('join-form-wrap');
const welcomeEl  = document.getElementById('join-welcome');

function showInvalid(message) {
  loadingEl.style.display = 'none';
  invalidEl.style.display = 'block';
  invalidMsg.textContent  = message;
}

(async function checkInvite() {
  if (!inviteToken) {
    showInvalid('No invite link found. Make sure you opened the exact link the admin gave you.');
    return;
  }

  try {
    const res  = await fetch(`/api/duelist-auth/invite/${encodeURIComponent(inviteToken)}`);
    const data = await res.json();

    if (!res.ok || !data.valid) {
      showInvalid(data.message || 'This invite link is invalid.');
      return;
    }

    loadingEl.style.display = 'none';
    formEl.style.display    = 'block';
    welcomeEl.textContent   = `Welcome, ${data.name}! Set up your login below.`;
  } catch (err) {
    showInvalid('Could not reach the server. Try refreshing the page.');
  }
})();

window.submitJoin = async function() {
  const username  = document.getElementById('join-username').value.trim();
  const password  = document.getElementById('join-password').value;
  const password2 = document.getElementById('join-password2').value;
  const errEl     = document.getElementById('join-err');

  errEl.style.display = 'none';

  if (!username || !password) {
    errEl.textContent = 'Please fill in both fields.';
    errEl.style.display = 'block';
    return;
  }
  if (password !== password2) {
    errEl.textContent = 'Passwords do not match.';
    errEl.style.display = 'block';
    return;
  }

  const res  = await fetch('/api/duelist-auth/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token: inviteToken, username, password }),
  });
  const data = await res.json();

  if (!data.success) {
    errEl.textContent = data.message || 'Something went wrong.';
    errEl.style.display = 'block';
    return;
  }

  formEl.style.display = 'none';
  document.getElementById('join-success').style.display = 'block';
  document.getElementById('join-success-name').textContent = data.name;
};