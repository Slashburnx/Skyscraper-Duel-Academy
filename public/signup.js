// ═══════════════════════════════════════════════════════════
// YGO SKYSCRAPER — SIGNUP.JS
// Self-serve account claiming (no invite link needed) — the
// request still needs Moderator approval before it activates.
// ═══════════════════════════════════════════════════════════

injectNav(null);

(async function init() {
  const res  = await fetch('/api/duelist-auth/unclaimed');
  const data = await res.json();

  document.getElementById('signup-loading').style.display = 'none';

  if (!data.unclaimed.length) {
    document.getElementById('signup-empty').style.display = 'block';
    return;
  }

  const select = document.getElementById('signup-duelist');
  select.innerHTML = data.unclaimed.map(d => `<option value="${d.duelistId}">${d.name}</option>`).join('');
  document.getElementById('signup-form-wrap').style.display = 'block';
})();

window.submitSignup = async function() {
  const duelistId = document.getElementById('signup-duelist').value;
  const username   = document.getElementById('signup-username').value.trim();
  const password   = document.getElementById('signup-password').value;
  const password2  = document.getElementById('signup-password2').value;
  const errEl      = document.getElementById('signup-err');
  errEl.style.display = 'none';

  if (!duelistId || !username || !password) {
    errEl.textContent = 'Please fill in all fields.';
    errEl.style.display = 'block';
    return;
  }
  if (password !== password2) {
    errEl.textContent = 'Passwords do not match.';
    errEl.style.display = 'block';
    return;
  }

  const res  = await fetch('/api/duelist-auth/request-claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ duelistId, username, password }),
  });
  const data = await res.json();

  if (!data.success) {
    errEl.textContent = data.message || 'Something went wrong.';
    errEl.style.display = 'block';
    return;
  }

  document.getElementById('signup-form-wrap').style.display = 'none';
  document.getElementById('signup-success').style.display = 'block';
};