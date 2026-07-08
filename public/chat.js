// ═══════════════════════════════════════════════════════════
// YGO SKYSCRAPER — CHAT.JS
// Three chat types: shared room, admin inbox, duelist DMs.
// Polls every 4s for new messages (same pattern as the rest of
// the site — no websockets needed for a hobby-scale chat).
// ═══════════════════════════════════════════════════════════

injectNav('chat.html');

let iAmAdmin   = false;
let myDuelistId = null;
let myName      = null;
let activeTab   = 'room';
let activeContactId = null; // which duelist's inbox/DM is currently open
let pollTimer   = null;

const messagesEl = document.getElementById('chat-messages');
const contactsEl = document.getElementById('chat-contacts');

// ── Init: figure out who's logged in ────────────────────────
(async function init() {
  const [adminRes, duelistRes] = await Promise.all([
    fetch('/api/admin/check',        { credentials: 'include' }).then(r => r.json()),
    fetch('/api/duelist-auth/check', { credentials: 'include' }).then(r => r.json()),
  ]);

  if (!adminRes.isAdmin && !duelistRes.loggedIn) {
    document.getElementById('chat-signed-out').style.display = 'block';
    return;
  }

  // A Moderator (a duelist account with the Moderator role) gets the same
  // inbox view as literal Admin — sees every duelist's thread, not just
  // their own. They still keep DMs too, since they're also a real duelist.
  const isModerator = !adminRes.isAdmin && duelistRes.loggedIn && duelistRes.isModerator;
  iAmAdmin = adminRes.isAdmin || isModerator;
  if (duelistRes.loggedIn) { myDuelistId = duelistRes.duelistId; myName = duelistRes.name; }

  document.getElementById('chat-app').style.display = 'block';
  if (duelistRes.loggedIn) document.getElementById('dm-tab-btn').style.display = 'block';

  switchTab('room');
})();

// ── Tab switching ────────────────────────────────────────────
window.switchTab = function(tab) {
  activeTab = tab;
  activeContactId = null;
  document.querySelectorAll('.chat-tab').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));

  if (pollTimer) clearInterval(pollTimer);
  contactsEl.style.display = 'none';
  contactsEl.innerHTML = '';
  messagesEl.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;">Loading...</p>';

  if (tab === 'room') {
    startPolling(loadRoom);
  } else if (tab === 'inbox') {
    if (iAmAdmin) loadInboxContacts();
    else startPolling(loadMyInbox);
  } else if (tab === 'dm') {
    loadDmContacts();
  }
};

function startPolling(fn) {
  fn();
  pollTimer = setInterval(fn, 4000);
}

// ── Rendering ────────────────────────────────────────────────
function renderMessages(messages, { isMine }) {
  if (!messages.length) {
    messagesEl.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;">No messages yet — say hello!</p>';
    return;
  }
  const wasAtBottom = messagesEl.scrollTop + messagesEl.clientHeight >= messagesEl.scrollHeight - 30;

  messagesEl.innerHTML = messages.map(m => `
    <div class="chat-msg ${isMine(m) ? 'mine' : ''}">
      <div class="who">${m.senderName}<span class="when">${new Date(m.createdAt).toLocaleString()}</span></div>
      <div class="text">${escapeHtml(m.text)}</div>
    </div>
  `).join('');

  if (wasAtBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// ── Academy Room ─────────────────────────────────────────────
async function loadRoom() {
  const res  = await fetch('/api/chat/room', { credentials: 'include' });
  const data = await res.json();
  renderMessages(data.messages || [], { isMine: m => (iAmAdmin && m.senderType === 'admin') || m.senderId === myDuelistId });
}

// ── Admin Inbox ──────────────────────────────────────────────
async function loadInboxContacts() {
  contactsEl.style.display = 'block';
  const res  = await fetch('/api/chat/inbox-list', { credentials: 'include' });
  const data = await res.json();

  if (!data.conversations.length) {
    contactsEl.innerHTML = '<p style="color:var(--muted);font-size:0.8rem;">No duelist accounts yet.</p>';
    messagesEl.innerHTML = '';
    return;
  }

  contactsEl.innerHTML = data.conversations.map(c => `
    <div class="chat-contact ${activeContactId === c.duelistId ? 'active' : ''}" onclick="openInboxWith('${c.duelistId}')">
      <div>${c.name}${c.unread ? ' 🔴' : ''}</div>
      <div class="last">${c.lastMessage ? escapeHtml(c.lastMessage).slice(0,40) : 'No messages yet'}</div>
    </div>
  `).join('');

  if (!activeContactId) {
    messagesEl.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;">Pick a duelist on the left to view their inbox.</p>';
  }
}

window.openInboxWith = function(duelistId) {
  activeContactId = duelistId;
  if (pollTimer) clearInterval(pollTimer);
  startPolling(async () => {
    const res  = await fetch(`/api/chat/inbox/${duelistId}`, { credentials: 'include' });
    const data = await res.json();
    renderMessages(data.messages || [], { isMine: m => m.senderType === 'admin' });
  });
  loadInboxContacts(); // refresh contact list highlighting + clear unread dot
};

async function loadMyInbox() {
  const res  = await fetch('/api/chat/inbox/mine', { credentials: 'include' });
  const data = await res.json();
  renderMessages(data.messages || [], { isMine: m => m.senderType === 'duelist' });
}

// ── Duelist DMs ──────────────────────────────────────────────
async function loadDmContacts() {
  contactsEl.style.display = 'block';
  const res  = await fetch('/api/chat/dm-contacts', { credentials: 'include' });
  const data = await res.json();

  if (!data.contacts.length) {
    contactsEl.innerHTML = '<p style="color:var(--muted);font-size:0.8rem;">No other duelist accounts yet.</p>';
    messagesEl.innerHTML = '';
    return;
  }

  contactsEl.innerHTML = data.contacts.map(c => `
    <div class="chat-contact ${activeContactId === c.duelistId ? 'active' : ''}" onclick="openDmWith('${c.duelistId}')">
      ${c.name}
    </div>
  `).join('');

  if (!activeContactId) {
    messagesEl.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;">Pick a duelist on the left to start chatting.</p>';
  }
}

window.openDmWith = function(otherId) {
  activeContactId = otherId;
  if (pollTimer) clearInterval(pollTimer);
  startPolling(async () => {
    const res  = await fetch(`/api/chat/dm/${otherId}`, { credentials: 'include' });
    const data = await res.json();
    renderMessages(data.messages || [], { isMine: m => m.senderId === myDuelistId });
  });
  document.querySelectorAll('.chat-contact').forEach(el => el.classList.remove('active'));
};

// ── Sending ──────────────────────────────────────────────────
window.sendCurrentMessage = async function() {
  const input = document.getElementById('chat-input');
  const text  = input.value.trim();
  if (!text) return;

  let url = null;
  if (activeTab === 'room') {
    url = '/api/chat/room';
  } else if (activeTab === 'inbox') {
    url = iAmAdmin ? (activeContactId && `/api/chat/inbox/${activeContactId}`) : '/api/chat/inbox/mine';
  } else if (activeTab === 'dm') {
    url = activeContactId && `/api/chat/dm/${activeContactId}`;
  }

  if (!url) { notify('⚠️ Pick a conversation first'); return; }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (!data.success) { notify(`⚠️ ${data.message || 'Could not send'}`); return; }

  input.value = '';
  // Re-fetch immediately so the sender sees their own message right away.
  if (activeTab === 'room') loadRoom();
  else if (activeTab === 'inbox') iAmAdmin ? openInboxWith(activeContactId) : loadMyInbox();
  else if (activeTab === 'dm') openDmWith(activeContactId);
};

document.getElementById('chat-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCurrentMessage(); }
});