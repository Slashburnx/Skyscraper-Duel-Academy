// ═══════════════════════════════════════════════════════════
// YGO SKYSCRAPER — ARCHETYPES.JS
// Firebase-powered archetypes page
// Admin can edit existing AND add new archetypes
// ═══════════════════════════════════════════════════════════

import { injectNav, injectModals } from './nav.js';
import { fbGet, fbSet, fbListen, fbRemove, PATHS } from './api.js';

// ── State ──────────────────────────────────────────────────
let archetypes  = [];
let duelists    = [];
let archFilter  = 'all';
let editingId   = null;

// ── Init ──────────────────────────────────────────────────
injectNav('archetypes.html');
injectModals();

// ── Seed Firebase if empty ─────────────────────────────────
fbGet(PATHS.archetypes).then(val => {
  if (!val) {
    const obj = {};
    INITIAL_ARCHETYPES.forEach(a => { obj[a.id] = a; });
    fbSet(PATHS.archetypes, obj);
  }
});

// ── Firebase listeners ─────────────────────────────────────
fbListen(PATHS.archetypes, val => {
  archetypes = val ? Object.values(val).sort((a,b) => a.name.localeCompare(b.name)) : [];
  renderArchTable();
});

fbListen(PATHS.duelists, val => {
  duelists = val ? Object.values(val) : [];
  renderArchTable();
});

// ── Tab switcher ───────────────────────────────────────────
window.switchTab = function(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-table').style.display = tab === 'table' ? '' : 'none';
  document.getElementById('tab-rules').style.display = tab === 'rules' ? '' : 'none';
};

// ── Filter ─────────────────────────────────────────────────
window.setArchFilter = function(f, btn) {
  archFilter = f;
  document.querySelectorAll('#tab-table .filter-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  renderArchTable();
};

// ── Get owners ─────────────────────────────────────────────
function getOwners(archName) {
  return duelists.filter(d => d.archs && d.archs.includes(archName)).map(d => d.name);
}

// ── Render table ───────────────────────────────────────────
function renderArchTable() {
  const admin = isAdminLoggedIn();
  const q     = (document.getElementById('arch-search')?.value || '').toLowerCase();
  const ecol  = document.getElementById('arch-edit-col');
  if (ecol) ecol.style.display = admin ? '' : 'none';

  const filtered = archetypes.filter(a => {
    const owners   = getOwners(a.name);
    const matchName  = a.name.toLowerCase().includes(q);
    const matchOwner = owners.join(' ').toLowerCase().includes(q);
    if (!matchName && !matchOwner) return false;
    if (archFilter === 'available')  return owners.length === 0 && a.status !== 'Unavailable' && a.status !== 'Forbidden';
    if (archFilter === 'taken')      return owners.length > 0;
    if (archFilter === 'restricted') return a.status && a.status !== '';
    return true;
  });

  const countEl = document.getElementById('arch-count');
  if (countEl) countEl.textContent = filtered.length + ' archetypes';

  const tbody = document.getElementById('arch-tbody');
  if (!tbody) return;

  tbody.innerHTML = filtered.map(a => {
    const owners = getOwners(a.name);
    const taken  = owners.length > 0;

    // Inline edit row
    if (editingId === a.id) {
      const statOpts = ['','Forbidden','Semi Limited','Limited','Unavailable']
        .map(s => `<option value="${s}" ${a.status===s?'selected':''}>${s||'—'}</option>`).join('');
      return `
        <tr style="background:rgba(200,155,0,0.04);">
          <td style="font-weight:700;color:var(--gold);">${a.name}</td>
          <td><input class="inline-inp" id="ae-notes" value="${(a.notes||'').replace(/"/g,'&quot;')}"/></td>
          <td><input class="inline-inp" type="number" id="ae-price" value="${a.price}" style="width:90px;"/></td>
          <td style="color:var(--muted);font-size:0.78rem;">${owners.join(', ')||'Available'}</td>
          <td><select class="inline-sel" id="ae-status">${statOpts}</select></td>
          <td style="display:flex;gap:4px;">
            <button class="save-inline" onclick="saveArchEdit('${a.id}')">💾</button>
            <button class="btn-icon" onclick="cancelArchEdit()">✕</button>
          </td>
        </tr>`;
    }

    // Status badge
    let badge = '—';
    if (a.status === 'Forbidden')     badge = '<span class="badge b-red">Forbidden</span>';
    else if (a.status === 'Semi Limited') badge = '<span class="badge b-gold">Semi Limited</span>';
    else if (a.status === 'Limited')     badge = '<span class="badge b-blue">Limited</span>';
    else if (a.status === 'Unavailable')  badge = '<span class="badge b-grey">Unavailable</span>';
    else if (taken)                       badge = '<span class="badge b-green">Taken</span>';

    const ownerCell = taken
      ? `<span style="color:#4FD49A;">${owners.join(', ')}</span>`
      : `<span style="color:var(--muted);">Available</span>`;

    const priceCell = a.status === 'Unavailable'
      ? '<span style="color:var(--muted);">—</span>'
      : `<span style="color:var(--gold);font-weight:600;">${a.price>0?a.price.toLocaleString()+' DP':'—'}</span>`;

    return `
      <tr>
        <td style="font-weight:600;">${a.name}</td>
        <td style="color:var(--muted);font-size:0.76rem;max-width:200px;">${a.notes||'—'}</td>
        <td>${priceCell}</td>
        <td style="font-size:0.8rem;">${ownerCell}</td>
        <td>${badge}</td>
        ${admin ? `<td style="display:flex;gap:4px;">
          <button class="btn-icon" onclick="startArchEdit('${a.id}')">✏️</button>
          <button class="btn-icon" style="color:var(--sl);" onclick="deleteArch('${a.id}','${a.name.replace(/'/g,"\\'")}')">🗑</button>
        </td>` : ''}
      </tr>`;
  }).join('');
}

// ── Inline edit ────────────────────────────────────────────
window.startArchEdit  = function(id) { editingId = id; renderArchTable(); };
window.cancelArchEdit = function()   { editingId = null; renderArchTable(); };

window.saveArchEdit = async function(id) {
  const arch = archetypes.find(a => a.id === id);
  if (!arch) return;
  const updated = {
    ...arch,
    notes : document.getElementById('ae-notes').value,
    price : parseInt(document.getElementById('ae-price').value) || 0,
    status: document.getElementById('ae-status').value,
  };
  await fbSet(PATHS.archetypes + '/' + id, updated);
  editingId = null;
  notify('✅ Archetype saved');
};

// ── Delete arch ────────────────────────────────────────────
window.deleteArch = async function(id, name) {
  if (!confirm(`Delete "${name}" from the archetype list? This cannot be undone.`)) return;
  await fbRemove(PATHS.archetypes + '/' + id);
  notify(`"${name}" deleted`);
};

// ── Add new archetype ──────────────────────────────────────
window.openAddArch = function() {
  document.getElementById('na-name').value   = '';
  document.getElementById('na-notes').value  = '';
  document.getElementById('na-price').value  = '';
  document.getElementById('na-status').value = '';
  openModal('modal-add-arch');
};

window.submitAddArch = async function() {
  const name = document.getElementById('na-name').value.trim();
  if (!name) { notify('⚠️ Name is required'); return; }

  // Check duplicate
  if (archetypes.find(a => a.name.toLowerCase() === name.toLowerCase())) {
    notify('⚠️ Archetype already exists'); return;
  }

  const newId = 'a' + Date.now();
  const arch  = {
    id    : newId,
    name,
    notes : document.getElementById('na-notes').value.trim(),
    price : parseInt(document.getElementById('na-price').value) || 0,
    status: document.getElementById('na-status').value,
  };
  await fbSet(PATHS.archetypes + '/' + newId, arch);
  closeModal('modal-add-arch');
  notify(`✅ "${name}" added`);
};

window.onAdminChange = function() { renderArchTable(); };

// Make renderArchTable global for oninput
window.renderArchTable = renderArchTable;