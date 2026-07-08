// ═══════════════════════════════════════════════════════════
// YGO SKYSCRAPER — NAV.JS
// Navigation, admin login, password change
// Admin password is verified + stored securely by the Node.js server
// (hashed in MongoDB) — the browser never sees or stores it.
// ═══════════════════════════════════════════════════════════

import { adminLogin, adminLogout, adminCheck, adminChangePassword } from './api.js';

const NAV_PAGES = [
  ['duelists.html',   '👥 Duelists'],
  ['archetypes.html', '📚 Archetypes'],
  ['shop.html',       '🛒 Shop'],
  ['exams.html',      '📝 Exams'],
  ['wheel.html',      '🎡 Wheel'],
  ['bracket.html',    '🏆 Bracket'],
  ['rules.html',      '📖 Rules'],
  ['requests.html',   '📋 Requests'],
  ['chat.html',       '💬 Chat'],
  ['profile.html',    '🔑 My Account'],
];

// ── Build and inject nav ───────────────────────────────────
export function injectNav(activePage) {
  const adminOn = isAdminLoggedIn();
  const links = NAV_PAGES.map(([href, label]) =>
    `<a href="${href}" class="nav-link${href === activePage ? ' active' : ''}"
      onclick="closeHamburger()">${label}</a>`
  ).join('');

  document.getElementById('nav-root').innerHTML = `
    <nav>
      <div class="nav-inner">
        <a href="index.html" class="nav-logo" style="text-decoration:none;">YGO <span>Skyscraper</span></a>
        <div class="nav-links" id="nav-links">${links}</div>
        <button class="nav-hamburger" id="nav-hamburger" onclick="toggleHamburger()">☰</button>
      </div>
    </nav>`;

  if (adminOn) document.body.classList.add('admin-mode');

  // The sessionStorage flag is just for instant UI on page load. The real
  // truth is the server's httpOnly cookies (12h admin session / 14d duelist
  // session) — reconcile in case they expired or were cleared, so edit
  // buttons don't show when writes would actually be rejected by the server.
  //
  // A Moderator (a duelist account with the "Moderator" role) gets treated
  // exactly like Admin for UI purposes — every page's existing
  // isAdminLoggedIn() checks work for Moderators automatically this way,
  // with no changes needed on any of those pages.
  Promise.all([
    adminCheck(),
    fetch('/api/duelist-auth/check', { credentials: 'include' }).then(r => r.json()).catch(() => ({ loggedIn: false })),
  ]).then(([isAdmin, duelistStatus]) => {
    const isModerator = !isAdmin && duelistStatus.loggedIn && duelistStatus.isModerator;
    const effective = isAdmin || isModerator;

    if (effective !== adminOn) {
      setAdminSession(effective);
      document.body.classList.toggle('admin-mode', effective);
      if (typeof window.onAdminChange === 'function') window.onAdminChange(effective);
    }
  });
}

// ── Hamburger ──────────────────────────────────────────────
window.toggleHamburger = function() {
  const links = document.getElementById('nav-links');
  const btn   = document.getElementById('nav-hamburger');
  if (!links) return;
  const isOpen = links.classList.toggle('open');
  if (btn) btn.textContent = isOpen ? '✕' : '☰';
};

window.closeHamburger = function() {
  const links = document.getElementById('nav-links');
  const btn   = document.getElementById('nav-hamburger');
  if (links) links.classList.remove('open');
  if (btn)   btn.textContent = '☰';
};

document.addEventListener('click', e => {
  const nav = document.querySelector('nav');
  if (nav && !nav.contains(e.target)) window.closeHamburger();
});

// ── Admin toggle ───────────────────────────────────────────
window.toggleAdmin = function() {
  window.closeHamburger();
  if (isAdminLoggedIn()) {
    adminLogout();
    setAdminSession(false);
    document.body.classList.remove('admin-mode');
    const btn = document.getElementById('nav-admin-btn');
    if (btn) { btn.textContent = '🔒 Admin'; btn.classList.remove('on'); }
    notify('Admin mode off');
    if (typeof window.onAdminChange === 'function') window.onAdminChange(false);
  } else {
    openModal('modal-admin');
    setTimeout(() => document.getElementById('admin-pw-inp')?.focus(), 80);
  }
};

// ── Admin login ────────────────────────────────────────────
window.doAdminLogin = async function() {
  const inp = document.getElementById('admin-pw-inp');
  const err = document.getElementById('admin-pw-err');
  if (!inp || !err) return;

  const result = await adminLogin(inp.value);

  if (result.success) {
    setAdminSession(true);
    document.body.classList.add('admin-mode');
    closeModal('modal-admin');
    inp.value = '';
    err.style.display = 'none';
    const btn = document.getElementById('nav-admin-btn');
    if (btn) { btn.textContent = '🔓 Admin ON'; btn.classList.add('on'); }
    notify('✅ Admin mode on');
    if (typeof window.onAdminChange === 'function') window.onAdminChange(true);
  } else {
    err.style.display = 'block';
    err.textContent   = result.message || 'Wrong password. Try again.';
  }
};

// ── Toggle password visibility ─────────────────────────────
window.togglePwVisibility = function(inputId, btnId) {
  const inp = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  if (!inp) return;
  if (inp.type === 'password') {
    inp.type     = 'text';
    if (btn) btn.textContent = '🙈';
  } else {
    inp.type     = 'password';
    if (btn) btn.textContent = '👁';
  }
};

// ── Change password ────────────────────────────────────────
window.doChangePassword = async function() {
  const cur  = document.getElementById('pw-cur').value;
  const nw   = document.getElementById('pw-new').value.trim();
  const conf = document.getElementById('pw-conf').value.trim();
  const err  = document.getElementById('pw-err');

  if (!nw) {
    err.style.display = 'block'; err.textContent = 'New password cannot be empty.'; return;
  }
  if (nw !== conf) {
    err.style.display = 'block'; err.textContent = 'Passwords do not match.'; return;
  }

  const result = await adminChangePassword(cur, nw);
  if (!result.success) {
    err.style.display = 'block'; err.textContent = result.message || 'Could not change password.'; return;
  }

  closeModal('modal-change-pw');
  ['pw-cur','pw-new','pw-conf'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  err.style.display = 'none';
  notify('✅ Password changed successfully');
};

// ── Modal helpers ──────────────────────────────────────────
window.openModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
};

window.closeModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
};

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    window.closeHamburger();
  }
});

// ── Shared modal HTML injected into every page ─────────────
export function injectModals() {
  document.body.insertAdjacentHTML('beforeend', `

  <!-- ADMIN LOGIN MODAL -->
  <div class="modal-overlay" id="modal-admin">
    <div class="modal">
      <h2>🔐 Admin Login</h2>
      <div class="form-group">
        <label>Password</label>
        <div style="position:relative;">
          <input type="password" id="admin-pw-inp" class="form-ctrl"
            placeholder="Enter password"
            onkeydown="if(event.key==='Enter') doAdminLogin()"
            autocomplete="off"
            style="padding-right:44px;"/>
          <button id="btn-show-login" onclick="togglePwVisibility('admin-pw-inp','btn-show-login')"
            style="position:absolute;right:10px;top:50%;transform:translateY(-50%);
                   background:none;border:none;cursor:pointer;font-size:1rem;color:var(--muted);">👁</button>
        </div>
        <div id="admin-pw-err" class="form-err"></div>
      </div>
      <div class="modal-actions">
        <button class="btn-outline" onclick="closeModal('modal-admin')">Cancel</button>
        <button class="btn-gold" onclick="doAdminLogin()">Login</button>
      </div>
    </div>
  </div>

  <!-- CHANGE PASSWORD MODAL -->
  <div class="modal-overlay" id="modal-change-pw">
    <div class="modal">
      <h2>🔑 Change Password</h2>
      <div class="form-group">
        <label>Current Password</label>
        <div style="position:relative;">
          <input type="password" id="pw-cur" class="form-ctrl" placeholder="Current password" style="padding-right:44px;"/>
          <button id="btn-show-cur" onclick="togglePwVisibility('pw-cur','btn-show-cur')"
            style="position:absolute;right:10px;top:50%;transform:translateY(-50%);
                   background:none;border:none;cursor:pointer;font-size:1rem;color:var(--muted);">👁</button>
        </div>
      </div>
      <div class="form-group">
        <label>New Password</label>
        <div style="position:relative;">
          <input type="password" id="pw-new" class="form-ctrl" placeholder="New password" style="padding-right:44px;"/>
          <button id="btn-show-new" onclick="togglePwVisibility('pw-new','btn-show-new')"
            style="position:absolute;right:10px;top:50%;transform:translateY(-50%);
                   background:none;border:none;cursor:pointer;font-size:1rem;color:var(--muted);">👁</button>
        </div>
      </div>
      <div class="form-group">
        <label>Confirm New Password</label>
        <div style="position:relative;">
          <input type="password" id="pw-conf" class="form-ctrl" placeholder="Confirm new password" style="padding-right:44px;"/>
          <button id="btn-show-conf" onclick="togglePwVisibility('pw-conf','btn-show-conf')"
            style="position:absolute;right:10px;top:50%;transform:translateY(-50%);
                   background:none;border:none;cursor:pointer;font-size:1rem;color:var(--muted);">👁</button>
        </div>
      </div>
      <div id="pw-err" class="form-err"></div>
      <div class="modal-actions">
        <button class="btn-outline" onclick="closeModal('modal-change-pw')">Cancel</button>
        <button class="btn-gold" onclick="doChangePassword()">Save Password</button>
      </div>
    </div>
  </div>

  <!-- NOTIFICATION -->
  <div id="notif" class="notif" style="display:none;"></div>
  `);
}

// Also expose as plain globals — some pages (bracket, decklists, exams,
// rules, shop, wheel) load this file directly as a <script type="module">
// and call injectNav(...) as a bare global, not via import.
window.injectNav = injectNav;
window.injectModals = injectModals;