// ═══════════════════════════════════════════════════════════
// YGO SKYSCRAPER — RESET-PASSWORD.JS
// ═══════════════════════════════════════════════════════════

injectNav(null);

const params = new URLSearchParams(window.location.search);
const resetToken = params.get('token');

const loadingEl  = document.getElementById('reset-loading');
const invalidEl  = document.getElementById('reset-invalid');
const invalidMsg = document.getElementById('reset-invalid-msg');
const formEl     = document.getElementById('reset-form-wrap');

function showInvalid(message) {
  loadingEl.style.display = 'none';
  invalidEl.style.display = 'block';
  invalidMsg.textContent  = message;
}

(async function checkToken() {
  if (!resetToken) {
    showInvalid('No reset link found. Make sure you opened the exact link the moderator gave you.');
    return;
  }
  try {
    const res  = await fetch(`/api/duelist-auth/reset/${encodeURIComponent(resetToken)}`);
    const data = await res.json();
    if (!res.ok || !data.valid) {
      showInvalid(data.message || 'This reset link is invalid.');
      return;
    }
    loadingEl.style.display = 'none';
    formEl.style.display    = 'block';
    document.getElementById('reset-welcome').textContent = `Hi ${data.name}, set your new password below.`;
  } catch (err) {
    showInvalid('Could not reach the server. Try refreshing the page.');
  }
})();

window.submitReset = async function() {
  const password  = document.getElementById('reset-password').value;
  const password2 = document.getElementById('reset-password2').value;
  const errEl     = document.getElementById('reset-err');
  errEl.style.display = 'none';

  if (!password) { errEl.textContent = 'Enter a new password.'; errEl.style.display = 'block'; return; }
  if (password !== password2) { errEl.textContent = 'Passwords do not match.'; errEl.style.display = 'block'; return; }

  const res  = await fetch('/api/duelist-auth/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token: resetToken, newPassword: password }),
  });
  const data = await res.json();

  if (!data.success) {
    errEl.textContent = data.message || 'Something went wrong.';
    errEl.style.display = 'block';
    return;
  }

  formEl.style.display = 'none';
  document.getElementById('reset-success').style.display = 'block';
};