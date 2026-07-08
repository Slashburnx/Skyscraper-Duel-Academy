// ═══════════════════════════════════════════════════════════
// YGO SKYSCRAPER — ADMIN-LOGIN.JS
// Hidden emergency/bootstrap login — not linked from the nav.
// ═══════════════════════════════════════════════════════════

injectNav(null);

(async function checkExisting() {
  const res  = await fetch('/api/admin/check', { credentials: 'include' });
  const data = await res.json();
  if (data.isAdmin) {
    document.getElementById('admin-logged-out').style.display = 'none';
    document.getElementById('admin-logged-in').style.display = 'block';
  }
})();

window.submitAdminLogin = async function() {
  const password = document.getElementById('admin-pw-input').value;
  const errEl    = document.getElementById('admin-login-err');
  errEl.style.display = 'none';

  const res  = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ password }),
  });
  const data = await res.json();

  if (!data.success) {
    errEl.textContent = data.message || 'Wrong password.';
    errEl.style.display = 'block';
    return;
  }

  notify('✅ Logged in as Admin');
  document.getElementById('admin-logged-out').style.display = 'none';
  document.getElementById('admin-logged-in').style.display = 'block';
};

window.doAdminLogout = async function() {
  await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
  notify('Logged out');
  window.location.reload();
};

window.submitAdminPwChange = async function() {
  const currentPassword = document.getElementById('admin-current-pw').value;
  const newPassword     = document.getElementById('admin-new-pw').value;
  const errEl = document.getElementById('admin-pw-change-err');
  errEl.style.display = 'none';

  const res  = await fetch('/api/admin/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await res.json();

  if (!data.success) {
    errEl.textContent = data.message || 'Could not change password.';
    errEl.style.display = 'block';
    return;
  }

  notify('✅ Password updated');
  document.getElementById('admin-current-pw').value = '';
  document.getElementById('admin-new-pw').value = '';
};