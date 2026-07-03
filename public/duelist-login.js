// ═══════════════════════════════════════════════════════════
// YGO SKYSCRAPER — DUELIST-LOGIN.JS
// ═══════════════════════════════════════════════════════════

injectNav(null);

(async function checkExistingSession() {
  try {
    const res  = await fetch('/api/duelist-auth/check', { credentials: 'include' });
    const data = await res.json();
    if (data.loggedIn) {
      document.getElementById('login-form-wrap').style.display = 'none';
      document.getElementById('login-logged-in').style.display = 'block';
      document.getElementById('login-current-name').textContent = data.name;
    }
  } catch (err) {
    // If the check fails, just show the login form as normal.
  }
})();

window.submitDuelistLogin = async function() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-err');
  errEl.style.display = 'none';

  if (!username || !password) {
    errEl.textContent = 'Please fill in both fields.';
    errEl.style.display = 'block';
    return;
  }

  const res  = await fetch('/api/duelist-auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();

  if (!data.success) {
    errEl.textContent = data.message || 'Login failed.';
    errEl.style.display = 'block';
    return;
  }

  notify(`✅ Welcome back, ${data.name}!`);
  window.location.href = 'index.html';
};

window.doDuelistLogout = async function() {
  await fetch('/api/duelist-auth/logout', { method: 'POST', credentials: 'include' });
  window.location.reload();
};