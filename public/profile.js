// ═══════════════════════════════════════════════════════════
// YGO SKYSCRAPER — PROFILE.JS
// Every duelist action now lives here: viewing (anyone), self-
// service (the account owner), and moderation (admin/moderator).
// ═══════════════════════════════════════════════════════════

// ⚠️ FILL THESE IN — see the setup steps in the message that came with this file.
const CLOUDINARY_CLOUD_NAME    = 'YOUR_CLOUD_NAME';
const CLOUDINARY_UPLOAD_PRESET = 'YOUR_UPLOAD_PRESET';

injectNav('profile.html');

let myId = null;
let viewingId = null;
let isOwnProfile = false;
let canModerate = false;
let currentDuelist = null;
let allDuelists = [];
let archCatalog = [];
let ticketCatalog = [];

(async function init() {
  const res  = await fetch('/api/duelist-auth/check', { credentials: 'include' });
  const data = await res.json();
  if (data.loggedIn) myId = data.duelistId;

  const params = new URLSearchParams(window.location.search);
  const idParam = params.get('id');

  if (idParam) {
    viewingId = idParam;
  } else if (myId) {
    viewingId = myId;
  } else {
    document.getElementById('profile-signed-out').style.display = 'block';
    return;
  }

  isOwnProfile = viewingId === myId;
  canModerate  = isAdminLoggedIn(); // covers both literal Admin and a Moderator's own account, site-wide
  document.getElementById('profile-app').style.display = 'block';
  await loadProfile();
})();

async function loadProfile() {
  const [dRes, archsRes, ticketsRes, allRes, requestsRes] = await Promise.all([
    fetch(`/api/data/duelists/${viewingId}`).then(r => r.json()),
    fetch('/api/data/archetypes').then(r => r.json()),
    fetch('/api/data/tickets').then(r => r.json()),
    fetch('/api/data/duelists').then(r => r.json()),
    isOwnProfile
      ? fetch('/api/requests/mine', { credentials: 'include' }).then(r => r.json())
      : Promise.resolve({ requests: [] }),
  ]);

  const d = dRes.value;
  if (!d) { notify('⚠️ Could not load that profile'); return; }
  currentDuelist = d;
  archCatalog   = Object.values(archsRes.value || {});
  ticketCatalog = Object.values(ticketsRes.value || {});
  allDuelists   = Object.values(allRes.value || {});

  // ── Header ──
  document.getElementById('profile-name').textContent = d.name;
  document.getElementById('profile-dorm').textContent = `${DORM_ICON[d.dorm || 'unassigned']} ${DORM_NAME[d.dorm || 'unassigned']}`;

  const possessive = isOwnProfile ? 'My' : `${d.name}'s`;
  document.getElementById('page-heading').textContent   = `🎓 ${possessive} Profile`;
  document.getElementById('heading-archs').textContent   = `📚 ${possessive} Archetypes`;
  document.getElementById('heading-roles').textContent   = `👑 ${possessive} Roles`;
  document.getElementById('heading-tickets').textContent = `🎟️ ${possessive} Tickets`;
  document.title = `${possessive} Profile — YGO Skyscraper`;

  const avatarSlot = document.getElementById('avatar-slot');
  avatarSlot.innerHTML = d.profilePicUrl
    ? `<img class="avatar-img" src="${d.profilePicUrl}" alt="${d.name}"/>`
    : `<div class="avatar-placeholder">👤</div>`;

  document.getElementById('avatar-edit-controls').style.display = isOwnProfile ? 'block' : 'none';
  document.getElementById('profile-requests-section').style.display = isOwnProfile ? 'block' : 'none';

  // ── Bio ──
  document.getElementById('bio-display').textContent = d.bio || (isOwnProfile ? 'No bio yet — add one below!' : 'No bio yet.');
  document.getElementById('bio-edit-controls').style.display = isOwnProfile ? 'block' : 'none';
  document.getElementById('bio-input').value = d.bio || '';

  // ── Stat cards ──
  document.getElementById('stat-dp').textContent      = (d.dp || 0).toLocaleString() + ' DP';
  document.getElementById('stat-archs').textContent   = `${(d.archs||[]).length} / 4`;
  document.getElementById('stat-tickets').textContent = (d.tickets || []).length;
  document.getElementById('stat-roles').textContent   = (d.titles || []).length;

  // ── Self-service action buttons ──
  renderSelfActions(d);

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

  // ── Tickets ──
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

  // ── Moderator controls ──
  renderModControls(d);
}

// ── Save the full duelist object back to the server ─────────
async function saveDuelist(updated) {
  const res = await fetch(`/api/data/duelists/${viewingId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ value: updated }),
  });
  return res.ok;
}

// ── Log out ──────────────────────────────────────────────────
window.doProfileLogout = async function() {
  await fetch('/api/duelist-auth/logout', { method: 'POST', credentials: 'include' });
  notify('Logged out');
  window.location.href = 'duelist-login.html';
};

// ── Bio (self-editable, no approval needed — just flavor text) ──
window.saveBio = async function() {
  const bio = document.getElementById('bio-input').value.trim();
  const ok = await saveDuelist({ ...currentDuelist, bio });
  if (ok) { notify('✅ Bio saved'); loadProfile(); }
  else notify('⚠️ Could not save bio');
};

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

// ═══════════════════════════════════════════════════════════
// SELF-SERVICE ACTIONS (own profile only)
// ═══════════════════════════════════════════════════════════
function renderSelfActions(d) {
  const wrap = document.getElementById('self-actions');
  if (!isOwnProfile) { wrap.style.display = 'none'; return; }

  const buttons = [];
  if (!d.dorm || d.dorm === 'unassigned') {
    buttons.push(`<button class="btn-icon" style="color:var(--gold);" onclick="joinADormSelf()">🎲 Join a Dorm</button>`);
  }
  if ((d.titles||[]).includes('Dorm Leader')) {
    buttons.push(`<button class="btn-icon" style="color:var(--sl);" onclick="requestKickSelf()">👢 Request Kick</button>`);
  }
  if ((d.tickets||[]).length) {
    buttons.push(`<button class="btn-icon" onclick="useTicketSelf()">🎟️ Use a Ticket</button>`);
  }

  wrap.style.display = buttons.length ? 'flex' : 'none';
  wrap.innerHTML = buttons.join('');
}

window.joinADormSelf = async function() {
  if (!confirm('Roll the dice to join a dorm?\n1-2 = Slifer Red · 3-4 = Ra Yellow · 5-6 = Obelisk Blue')) return;
  const res  = await fetch('/api/duelist-auth/me/join-dorm', { method: 'POST', credentials: 'include' });
  const data = await res.json();
  if (!data.success) { notify(`⚠️ ${data.message || 'Could not join a dorm'}`); return; }
  notify(`🎲 You rolled a ${data.roll} — welcome to ${DORM_NAME[data.dorm]}!`);
  loadProfile();
};

window.requestKickSelf = async function() {
  const leader = currentDuelist;
  const sameDorm = allDuelists.filter(d => d.dorm === leader.dorm && d.id !== leader.id);
  if (!sameDorm.length) { notify('⚠️ No other members in your dorm'); return; }

  const names  = sameDorm.map((d,i) => `${i+1}. ${d.name}`).join('\n');
  const choice = prompt(`Request to kick a member of your dorm.\nEnter a number:\n${names}`);
  if (choice === null) return;
  const target = sameDorm[parseInt(choice, 10) - 1];
  if (!target) { notify('⚠️ Invalid selection'); return; }

  let archToRemove = null;
  const targetArchs = target.archs || [];
  if (targetArchs.length > 1) {
    const archChoice = prompt(`Which of ${target.name}'s archetypes should be removed if approved?\n${targetArchs.map((a,i)=>`${i+1}. ${a}`).join('\n')}`);
    archToRemove = targetArchs[parseInt(archChoice,10)-1];
    if (!archToRemove) { notify('⚠️ Invalid selection'); return; }
  }

  if (!confirm(`Send a kick request for ${target.name} to the moderators?`)) return;

  const res  = await fetch('/api/requests/kick-member', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
    body: JSON.stringify({ targetId: target.id, archToRemove }),
  });
  const data = await res.json();
  if (!data.success) { notify(`⚠️ ${data.message || 'Could not submit request'}`); return; }
  notify(`✅ Kick request for ${target.name} sent for approval.`);
  loadProfile();
};

const AUTOMATED_TICKETS = {
  '☘️ Force Trade Ticket':       'force_trade',
  '☘️ Refund Ticket':            'refund',
  '☘️ Forbidden Hammer Ticket':  'forbidden_hammer',
  '☘️ Status Removal Ticket':    'status_removal',
  '☘️ Semi Duplicator Ticket':   'semi_duplicator',
  '☘️ Triplet Generator Ticket': 'triplet_generator',
  '☘️ Dorm Switcher Ticket':     'dorm_switcher',
  '☘️ Bracket Switcher Ticket':  'bracket_switcher',
};

window.useTicketSelf = async function() {
  const d = currentDuelist;
  const counts = {};
  d.tickets.forEach(t => { counts[t] = (counts[t]||0) + 1; });
  const names = Object.keys(counts);
  const list  = names.map((n,i) => `${i+1}. ${n} (x${counts[n]})`).join('\n');
  const choice = prompt(`Which ticket do you want to use?\n${list}`);
  if (choice === null) return;
  const ticketName = names[parseInt(choice, 10) - 1];
  if (!ticketName) { notify('⚠️ Invalid selection'); return; }

  const ticketType = AUTOMATED_TICKETS[ticketName];
  if (!ticketType) {
    notify('⚠️ This ticket isn\'t automated yet — ask a moderator to apply it manually.');
    return;
  }

  const params = {};

  if (ticketType === 'force_trade') {
    const others = allDuelists.filter(x => x.id !== d.id);
    const targetChoice = prompt(`Trade with who?\n${others.map((x,i)=>`${i+1}. ${x.name}`).join('\n')}`);
    const target = others[parseInt(targetChoice,10)-1];
    if (!target) { notify('⚠️ Invalid selection'); return; }
    if (!(d.archs||[]).length) { notify('⚠️ You have no archetypes to trade'); return; }
    if (!(target.archs||[]).length) { notify(`⚠️ ${target.name} has no archetypes to trade`); return; }
    const myArchChoice = prompt(`Which of YOUR archetypes do you give up?\n${d.archs.map((a,i)=>`${i+1}. ${a}`).join('\n')}`);
    const myArchetype = d.archs[parseInt(myArchChoice,10)-1];
    const theirArchChoice = prompt(`Which of ${target.name}'s archetypes do you want?\n${target.archs.map((a,i)=>`${i+1}. ${a}`).join('\n')}`);
    const theirArchetype = target.archs[parseInt(theirArchChoice,10)-1];
    if (!myArchetype || !theirArchetype) { notify('⚠️ Invalid selection'); return; }
    Object.assign(params, { targetId: target.id, myArchetype, theirArchetype });

  } else if (ticketType === 'refund') {
    if (!(d.archs||[]).length) { notify('⚠️ You have no archetypes to refund'); return; }
    const archChoice = prompt(`Refund which archetype?\n${d.archs.map((a,i)=>`${i+1}. ${a}`).join('\n')}`);
    const archetypeName = d.archs[parseInt(archChoice,10)-1];
    if (!archetypeName) { notify('⚠️ Invalid selection'); return; }
    params.archetypeName = archetypeName;

  } else if (ticketType === 'forbidden_hammer' || ticketType === 'semi_duplicator' || ticketType === 'triplet_generator') {
    const archetypeName = prompt('Type the exact name of the archetype to target:');
    if (!archetypeName) return;
    params.archetypeName = archetypeName.trim();

  } else if (ticketType === 'status_removal') {
    const flagged = archCatalog.filter(a => ['Forbidden','Semi-Duplicated','Triplicated'].includes(a.status));
    if (!flagged.length) { notify('⚠️ No archetypes currently have a status to remove'); return; }
    const archChoice = prompt(`Remove status from which archetype?\n${flagged.map((a,i)=>`${i+1}. ${a.name} (${a.status})`).join('\n')}`);
    const chosen = flagged[parseInt(archChoice,10)-1];
    if (!chosen) { notify('⚠️ Invalid selection'); return; }
    params.archetypeName = chosen.name;

  } else if (ticketType === 'dorm_switcher') {
    const list2 = allDuelists.map((x,i) => `${i+1}. ${x.name} (${x.dorm||'unassigned'})`).join('\n');
    const aChoice = prompt(`First duelist to swap dorms?\n${list2}`);
    const dA = allDuelists[parseInt(aChoice,10)-1];
    const bChoice = prompt(`Second duelist to swap dorms?\n${list2}`);
    const dB = allDuelists[parseInt(bChoice,10)-1];
    if (!dA || !dB || dA.id === dB.id) { notify('⚠️ Choose two different duelists'); return; }
    Object.assign(params, { duelistAId: dA.id, duelistBId: dB.id });

  } else if (ticketType === 'bracket_switcher') {
    const bpRes = await fetch('/api/data/bracket/players');
    const players = (await bpRes.json()).value || [];
    if (players.length < 2) { notify('⚠️ Not enough bracket entries to swap'); return; }
    const list3 = players.map((n,i) => `${i+1}. ${n}`).join('\n');
    const aChoice = prompt(`First bracket entry?\n${list3}`);
    const nameA = players[parseInt(aChoice,10)-1];
    const bChoice = prompt(`Second bracket entry?\n${list3}`);
    const nameB = players[parseInt(bChoice,10)-1];
    if (!nameA || !nameB || nameA === nameB) { notify('⚠️ Choose two different entries'); return; }
    Object.assign(params, { nameA, nameB });
  }

  if (!confirm(`Use ${ticketName}? This will be sent to the moderators for approval.`)) return;

  const res  = await fetch('/api/requests/use-ticket', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
    body: JSON.stringify({ ticketName, params }),
  });
  const data = await res.json();
  if (!data.success) { notify(`⚠️ ${data.message || 'Could not submit request'}`); return; }
  notify(`✅ ${ticketName} request sent for approval.`);
  loadProfile();
};

// ═══════════════════════════════════════════════════════════
// MODERATOR CONTROLS (admin or a Moderator, viewing ANY profile)
// ═══════════════════════════════════════════════════════════
function renderModControls(d) {
  const wrap = document.getElementById('mod-controls');
  if (!canModerate) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';

  document.getElementById('mod-name').value = d.name;
  document.getElementById('mod-dorm').value = d.dorm || 'unassigned';

  // Archetype assign dropdown — only ones not already owned by someone
  const ownedElsewhere = new Set();
  allDuelists.forEach(x => { if (x.id !== d.id) (x.archs||[]).forEach(a => ownedElsewhere.add(a)); });
  const availableArchs = archCatalog.filter(a => !ownedElsewhere.has(a.name) && a.status !== 'Forbidden');
  document.getElementById('mod-arch-select').innerHTML = availableArchs
    .map(a => `<option value="${a.name}">${a.name} (${a.price.toLocaleString()} DP)</option>`).join('');

  document.getElementById('mod-archs-list').innerHTML = (d.archs||[]).map(name => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:0.85rem;">${name}</span>
      <button class="btn-icon" style="color:var(--sl);font-size:0.72rem;" onclick="modRemoveArchetype('${name.replace(/'/g,"\\'")}')">Remove</button>
    </div>`).join('') || `<p style="color:var(--muted);font-size:0.8rem;">None assigned.</p>`;

  // Ticket assign dropdown
  document.getElementById('mod-ticket-select').innerHTML = ticketCatalog
    .map(t => `<option value="${t.name}">${t.name}</option>`).join('');

  const ticketCounts = {};
  (d.tickets||[]).forEach(t => { ticketCounts[t] = (ticketCounts[t]||0) + 1; });
  document.getElementById('mod-tickets-list').innerHTML = Object.keys(ticketCounts).map(name => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:0.85rem;">${name} x${ticketCounts[name]}</span>
      <button class="btn-icon" style="color:var(--sl);font-size:0.72rem;" onclick="modRemoveTicket('${name.replace(/'/g,"\\'")}')">Remove one</button>
    </div>`).join('') || `<p style="color:var(--muted);font-size:0.8rem;">None assigned.</p>`;

  // Roles checkboxes
  document.getElementById('mod-roles-checks').innerHTML = TITLE_LIST.map(t => `
    <label style="display:flex;align-items:center;gap:5px;font-size:0.78rem;cursor:pointer;
                  padding:3px 8px;border-radius:4px;border:1px solid var(--border);background:var(--surface);"
           title="${(TITLE_BENEFITS[t]||'').replace(/"/g,'&quot;')}">
      <input type="checkbox" value="${t}" ${(d.titles||[]).includes(t) ? 'checked' : ''}/>
      ${TITLE_ICON[t]||''} ${t}
    </label>`).join('');

  document.getElementById('mod-kick-section').style.display = (d.titles||[]).includes('Dorm Leader') ? 'block' : 'none';
}

window.modSaveName = async function() {
  const name = document.getElementById('mod-name').value.trim();
  if (!name) { notify('⚠️ Name cannot be empty'); return; }
  const ok = await saveDuelist({ ...currentDuelist, name });
  if (ok) { notify('✅ Name updated'); loadProfile(); } else notify('⚠️ Could not update name');
};

window.modSaveDorm = async function() {
  const dorm = document.getElementById('mod-dorm').value;
  const ok = await saveDuelist({ ...currentDuelist, dorm });
  if (ok) { notify(`✅ Placed in ${DORM_NAME[dorm]}`); loadProfile(); } else notify('⚠️ Could not update dorm');
};

window.modGrantDP = async function() {
  const amount = parseInt(document.getElementById('mod-dp-amount').value, 10);
  if (!amount || amount <= 0) { notify('⚠️ Enter a valid amount'); return; }
  const isGambler = (currentDuelist.titles||[]).includes('Gambler');
  const finalAmount = isGambler ? amount * 2 : amount;
  const newDp = (currentDuelist.dp||0) + finalAmount;
  const ok = await saveDuelist({ ...currentDuelist, dp: newDp });
  if (ok) {
    notify(isGambler
      ? `🎰 Gambler — ${amount.toLocaleString()} doubled to ${finalAmount.toLocaleString()}! New total: ${newDp.toLocaleString()}`
      : `✅ Granted ${finalAmount.toLocaleString()} DP. New total: ${newDp.toLocaleString()}`);
    loadProfile();
  } else notify('⚠️ Could not update DP');
};

window.modReduceDP = async function() {
  const amount = parseInt(document.getElementById('mod-dp-amount').value, 10);
  if (!amount || amount <= 0) { notify('⚠️ Enter a valid amount'); return; }
  const newDp = Math.max(0, (currentDuelist.dp||0) - amount);
  const ok = await saveDuelist({ ...currentDuelist, dp: newDp });
  if (ok) { notify(`✅ Reduced by ${amount.toLocaleString()} DP. New total: ${newDp.toLocaleString()}`); loadProfile(); }
  else notify('⚠️ Could not update DP');
};

window.modAddArchetype = async function() {
  const name = document.getElementById('mod-arch-select').value;
  if (!name) { notify('⚠️ No archetype selected'); return; }
  if ((currentDuelist.archs||[]).length >= 4) { notify('⚠️ Already has 4 archetypes (the max)'); return; }
  const archs = [...(currentDuelist.archs||[]), name];
  const ok = await saveDuelist({ ...currentDuelist, archs });
  if (ok) { notify(`✅ Assigned ${name}`); loadProfile(); } else notify('⚠️ Could not assign archetype');
};

window.modRemoveArchetype = async function(name) {
  if (!confirm(`Remove ${name}?`)) return;
  const archs = (currentDuelist.archs||[]).filter(a => a !== name);
  const ok = await saveDuelist({ ...currentDuelist, archs });
  if (ok) { notify(`Removed ${name}`); loadProfile(); } else notify('⚠️ Could not remove archetype');
};

window.modAddTicket = async function() {
  const name = document.getElementById('mod-ticket-select').value;
  if (!name) { notify('⚠️ No ticket selected'); return; }
  const tickets = [...(currentDuelist.tickets||[]), name];
  const ok = await saveDuelist({ ...currentDuelist, tickets });
  if (ok) { notify(`✅ Assigned ${name}`); loadProfile(); } else notify('⚠️ Could not assign ticket');
};

window.modRemoveTicket = async function(name) {
  const tickets = [...(currentDuelist.tickets||[])];
  const idx = tickets.indexOf(name);
  if (idx === -1) return;
  tickets.splice(idx, 1);
  const ok = await saveDuelist({ ...currentDuelist, tickets });
  if (ok) { notify(`Removed one ${name}`); loadProfile(); } else notify('⚠️ Could not remove ticket');
};

window.modSaveRoles = async function() {
  const checked = [...document.querySelectorAll('#mod-roles-checks input:checked')].map(el => el.value);
  const ok = await saveDuelist({ ...currentDuelist, titles: checked });
  if (ok) { notify('✅ Roles updated'); loadProfile(); } else notify('⚠️ Could not update roles');
};

window.modKickMember = async function() {
  const leader = currentDuelist;
  const sameDorm = allDuelists.filter(d => d.dorm === leader.dorm && d.id !== leader.id);
  if (!sameDorm.length) { notify('⚠️ No other members in this dorm'); return; }

  const names  = sameDorm.map((d,i) => `${i+1}. ${d.name}`).join('\n');
  const choice = prompt(`${leader.name} (Dorm Leader) is kicking a member.\nEnter a number:\n${names}`);
  if (choice === null) return;
  const target = sameDorm[parseInt(choice, 10) - 1];
  if (!target) { notify('⚠️ Invalid selection'); return; }

  if (!confirm(`Kick ${target.name} from the dorm?\nThey lose 10,000 DP, 1 archetype, and move to a random different dorm.`)) return;

  let removedArch = null;
  let remainingArchs = [...(target.archs||[])];
  if (remainingArchs.length === 1) {
    removedArch = remainingArchs[0];
    remainingArchs = [];
  } else if (remainingArchs.length > 1) {
    const archList   = remainingArchs.map((a,i) => `${i+1}. ${a}`).join('\n');
    const archChoice = prompt(`Which archetype should ${target.name} lose?\n${archList}`);
    const idx = parseInt(archChoice, 10) - 1;
    removedArch = remainingArchs[idx] ?? remainingArchs[0];
    remainingArchs = remainingArchs.filter(a => a !== removedArch);
  }

  const otherDorms = ['obelisk','ra','slifer'].filter(dm => dm !== target.dorm);
  const newDorm = otherDorms[Math.floor(Math.random() * otherDorms.length)];
  const newDp   = Math.max(0, (target.dp||0) - 10000);

  await fetch(`/api/data/duelists/${target.id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
    body: JSON.stringify({ value: { ...target, dp: newDp, archs: remainingArchs, dorm: newDorm } }),
  });
  await fetch(`/api/data/duelists/${leader.id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
    body: JSON.stringify({ value: { ...leader, lastKickAt: Date.now() } }),
  });

  notify(`👢 ${target.name} kicked: -10,000 DP${removedArch ? ', lost ' + removedArch : ''}, moved to ${DORM_NAME[newDorm]}.`);
  loadProfile();
};

window.modDeleteDuelist = async function() {
  if (!confirm(`Permanently delete ${currentDuelist.name}? This cannot be undone.`)) return;
  const res = await fetch(`/api/data/duelists/${viewingId}`, { method: 'DELETE', credentials: 'include' });
  if (res.ok) {
    notify('Duelist deleted');
    window.location.href = 'duelists.html';
  } else notify('⚠️ Could not delete duelist');
};