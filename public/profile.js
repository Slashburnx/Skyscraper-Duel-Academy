// ═══════════════════════════════════════════════════════════
// YGO SKYSCRAPER — PROFILE.JS
// ═══════════════════════════════════════════════════════════

// ⚠️ FILL THESE IN — see the setup steps in the message that came with this file.
// Only the cloud name + an UNSIGNED upload preset are needed here — never put
// your Cloudinary API secret in front-end code.
const CLOUDINARY_CLOUD_NAME    = 'YOUR_CLOUD_NAME';
const CLOUDINARY_UPLOAD_PRESET = 'YOUR_UPLOAD_PRESET';

injectNav('profile.html');

let myId = null;       // set if a duelist is logged in as themselves
let viewingId = null;  // whose profile is actually being shown
let isOwnProfile = false;

(async function init() {
  const res  = await fetch('/api/duelist-auth/check', { credentials: 'include' });
  const data = await res.json();
  if (data.loggedIn) myId = data.duelistId;

  const params = new URLSearchParams(window.location.search);
  const idParam = params.get('id');

  if (idParam) {
    // Public view of a specific duelist — no login required to look, just to edit your own.
    viewingId = idParam;
  } else if (myId) {
    // No ID given — fall back to "my own profile" for whoever's logged in.
    viewingId = myId;
  } else {
    document.getElementById('profile-signed-out').style.display = 'block';
    return;
  }

  isOwnProfile = viewingId === myId;
  document.getElementById('profile-app').style.display = 'block';
  await loadProfile();
})();

async function loadProfile() {
  const [dRes, archsRes, requestsRes] = await Promise.all([
    fetch(`/api/data/duelists/${viewingId}`).then(r => r.json()),
    fetch('/api/data/archetypes').then(r => r.json()),
    isOwnProfile
      ? fetch('/api/requests/mine', { credentials: 'include' }).then(r => r.json())
      : Promise.resolve({ requests: [] }),
  ]);

  const d = dRes.value;
  if (!d) { notify('⚠️ Could not load that profile'); return; }

  const archCatalog = Object.values(archsRes.value || {});

  // ── Header ──
  document.getElementById('profile-name').textContent = d.name;
  document.getElementById('profile-dorm').textContent = `${DORM_ICON[d.dorm] || ''} ${DORM_NAME[d.dorm] || d.dorm}`;

  const avatarSlot = document.getElementById('avatar-slot');
  avatarSlot.innerHTML = d.profilePicUrl
    ? `<img class="avatar-img" src="${d.profilePicUrl}" alt="${d.name}"/>`
    : `<div class="avatar-placeholder">👤</div>`;

  // Only the account owner can change their own photo.
  document.getElementById('avatar-edit-controls').style.display = isOwnProfile ? 'block' : 'none';

  // Only the account owner sees their own request history.
  document.getElementById('profile-requests-section').style.display = isOwnProfile ? 'block' : 'none';

  // ── Stat cards ──
  document.getElementById('stat-dp').textContent      = (d.dp || 0).toLocaleString() + ' DP';
  document.getElementById('stat-archs').textContent   = `${(d.archs||[]).length} / 4`;
  document.getElementById('stat-tickets').textContent = (d.tickets || []).length;
  document.getElementById('stat-roles').textContent   = (d.titles || []).length;

  // ── Archetypes ──
  const archs = d.archs || [];
  document.getElementById('profile-archs').innerHTML = archs.length
    ? archs.map(name => {
        const a = archCatalog.find(x => x.name === name) || {};
        return `<div class="card" style="padding:10px 14px;margin-bottom:8px;display:flex;justify-content:space-between;">
          <span style="font-weight:600;">${name}</span>
          <span style="color:var(--gold);">${a.price ? a.price.toLocaleString() + ' DP' : ''}</span>
        </div>`;
      }).join('')
    : `<p style="color:var(--muted);font-size:0.85rem;">No archetypes yet.</p>`;

  // ── Roles ──
  const titles = d.titles || [];
  document.getElementById('profile-roles').innerHTML = titles.length
    ? titles.map(t => `
        <div class="card" style="padding:10px 14px;margin-bottom:8px;">
          <div style="font-weight:600;">${TITLE_ICON[t]||''} ${t}</div>
          <div style="font-size:0.78rem;color:var(--muted);margin-top:3px;">${TITLE_BENEFITS[t]||''}</div>
        </div>`).join('')
    : `<p style="color:var(--muted);font-size:0.85rem;">No roles yet.</p>`;

  // ── Tickets (grouped by name with counts) ──
  const ticketCounts = {};
  (d.tickets || []).forEach(t => { ticketCounts[t] = (ticketCounts[t]||0) + 1; });
  const ticketNames = Object.keys(ticketCounts);
  document.getElementById('profile-tickets').innerHTML = ticketNames.length
    ? ticketNames.map(name => `
        <div class="card" style="padding:10px 14px;margin-bottom:8px;display:flex;justify-content:space-between;">
          <span>${name}</span><span style="color:var(--gold);">x${ticketCounts[name]}</span>
        </div>`).join('')
    : `<p style="color:var(--muted);font-size:0.85rem;">No tickets yet.</p>`;

  // ── My Requests ──
  const STATUS_COLOR = { pending:'#E0B400', approved:'#4CAF7D', rejected:'#FF6B6B' };
  const STATUS_LABEL = { pending:'⏳ Pending', approved:'✅ Approved', rejected:'❌ Rejected' };
  const reqs = requestsRes.requests || [];
  document.getElementById('profile-requests').innerHTML = reqs.length
    ? reqs.map(r => `
        <div class="card" style="padding:10px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
          <span style="font-size:0.85rem;">${new Date(r.createdAt).toLocaleDateString()} — ${r.type.replace('_',' ')}${r.itemName ? ': '+r.itemName : ''}${r.targetName ? ': '+r.targetName : ''}</span>
          <span style="font-size:0.75rem;font-weight:700;color:${STATUS_COLOR[r.status]};">${STATUS_LABEL[r.status]}</span>
        </div>`).join('')
    : `<p style="color:var(--muted);font-size:0.85rem;">No requests yet.</p>`;
}

// ── Avatar upload (Cloudinary, unsigned) ────────────────────
window.handleAvatarFile = async function(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (CLOUDINARY_CLOUD_NAME === 'YOUR_CLOUD_NAME') {
    notify('⚠️ Photo upload is not set up yet — ask the site owner to finish Cloudinary setup.');
    return;
  }

  const statusEl = document.getElementById('avatar-status');
  statusEl.textContent = 'Uploading...';

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  try {
    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData,
    });
    const uploadData = await uploadRes.json();
    if (!uploadData.secure_url) throw new Error('Upload failed');

    const saveRes = await fetch('/api/duelist-auth/me/avatar', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ url: uploadData.secure_url }),
    });
    const saveData = await saveRes.json();
    if (!saveData.success) throw new Error(saveData.message || 'Could not save photo');

    statusEl.textContent = '';
    notify('✅ Profile photo updated!');
    loadProfile();
  } catch (err) {
    statusEl.textContent = '';
    notify('⚠️ Photo upload failed. Try again.');
  }
};