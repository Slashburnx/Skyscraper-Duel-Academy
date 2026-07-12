// ═══════════════════════════════════════════════════════════
// YGO SKYSCRAPER — CHAT.JS
// Just the shared Academy Room now — DMs live on profile pages,
// and Admin Inbox is gone (the admin is just a duelist now too).
// ═══════════════════════════════════════════════════════════

injectNav('chat.html');

// ⚠️ Same Cloudinary setup as profile.js — fill these in once.
const CLOUDINARY_CLOUD_NAME    = 'YOUR_CLOUD_NAME';
const CLOUDINARY_UPLOAD_PRESET = 'YOUR_UPLOAD_PRESET';

let myDuelistId = null;
let pollTimer = null;
let pendingImageUrl = null;
const messagesEl = document.getElementById('chat-messages');

async function uploadImageToCloudinary(file) {
  if (CLOUDINARY_CLOUD_NAME === 'YOUR_CLOUD_NAME') {
    notify('⚠️ Image upload is not set up yet — ask the site owner to finish Cloudinary setup.');
    return null;
  }
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  try {
    const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
    const data = await res.json();
    return data.secure_url || null;
  } catch {
    notify('⚠️ Image upload failed.');
    return null;
  }
}

(async function init() {
  const [adminRes, duelistRes] = await Promise.all([
    fetch('/api/admin/check',        { credentials: 'include' }).then(r => r.json()),
    fetch('/api/duelist-auth/check', { credentials: 'include' }).then(r => r.json()),
  ]);

  if (!adminRes.isAdmin && !duelistRes.loggedIn) {
    document.getElementById('chat-signed-out').style.display = 'block';
    return;
  }
  if (duelistRes.loggedIn) myDuelistId = duelistRes.duelistId;

  document.getElementById('chat-app').style.display = 'block';
  loadRoom();
  pollTimer = setInterval(loadRoom, 4000);
})();

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

async function loadRoom() {
  const res  = await fetch('/api/chat/room', { credentials: 'include' });
  const data = await res.json();
  const messages = data.messages || [];

  if (!messages.length) {
    messagesEl.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;">No messages yet — say hello!</p>';
    return;
  }
  const wasAtBottom = messagesEl.scrollTop + messagesEl.clientHeight >= messagesEl.scrollHeight - 30;

  messagesEl.innerHTML = messages.map(m => `
    <div class="chat-msg ${m.senderId === myDuelistId ? 'mine' : ''}">
      <div class="who">${m.senderType === 'duelist' ? `<a href="profile.html?id=${m.senderId}" style="color:inherit;text-decoration:none;">${m.senderName}</a>` : m.senderName}<span class="when">${new Date(m.createdAt).toLocaleString()}</span></div>
      ${m.text ? `<div class="text">${escapeHtml(m.text)}</div>` : ''}
      ${m.imageUrl ? `<img src="${m.imageUrl}" style="max-width:220px;border-radius:8px;margin-top:6px;display:block;"/>` : ''}
    </div>
  `).join('');

  if (wasAtBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
}

window.handleChatImage = async function(event) {
  const file = event.target.files[0];
  if (!file) return;
  document.getElementById('chat-image-status').textContent = 'Uploading...';
  pendingImageUrl = await uploadImageToCloudinary(file);
  document.getElementById('chat-image-status').textContent = pendingImageUrl ? '✅ Image attached' : '';
};

window.sendRoomMessage = async function() {
  const input = document.getElementById('chat-input');
  const text  = input.value.trim();
  if (!text && !pendingImageUrl) return;

  const res = await fetch('/api/chat/room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ text, imageUrl: pendingImageUrl }),
  });
  const data = await res.json();
  if (!data.success) { notify(`⚠️ ${data.message || 'Could not send'}`); return; }

  input.value = '';
  pendingImageUrl = null;
  document.getElementById('chat-image-status').textContent = '';
  loadRoom();
};

document.getElementById('chat-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendRoomMessage(); }
});