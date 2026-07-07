// ═══════════════════════════════════════════════════════════
// YGO SKYSCRAPER — FORGOT-PASSWORD.JS
// ═══════════════════════════════════════════════════════════

injectNav(null);

window.submitForgot = async function() {
  const username = document.getElementById('forgot-username').value.trim();
  const errEl    = document.getElementById('forgot-err');
  errEl.style.display = 'none';

  if (!username) {
    errEl.textContent = 'Enter your username.';
    errEl.style.display = 'block';
    return;
  }

  const res  = await fetch('/api/duelist-auth/request-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  const data = await res.json();

  if (!data.success) {
    errEl.textContent = data.message || 'Something went wrong.';
    errEl.style.display = 'block';
    return;
  }

  document.getElementById('forgot-form-wrap').style.display = 'none';
  document.getElementById('forgot-success').style.display = 'block';
};