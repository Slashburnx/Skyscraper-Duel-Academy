// ═══════════════════════════════════════════════════════════
// YGO SKYSCRAPER — SIGNUP.JS
// True self-registration ("Facebook-style") — create your own
// identity, always starts in Unassigned once approved.
// ═══════════════════════════════════════════════════════════

injectNav(null);

window.submitSignup = async function() {
  const name      = document.getElementById('signup-name').value.trim();
  const username  = document.getElementById('signup-username').value.trim();
  const password  = document.getElementById('signup-password').value;
  const password2 = document.getElementById('signup-password2').value;
  const errEl     = document.getElementById('signup-err');
  errEl.style.display = 'none';

  if (!name || !username || !password) {
    errEl.textContent = 'Please fill in all fields.';
    errEl.style.display = 'block';
    return;
  }
  if (password !== password2) {
    errEl.textContent = 'Passwords do not match.';
    errEl.style.display = 'block';
    return;
  }

  const res  = await fetch('/api/duelist-auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, username, password }),
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