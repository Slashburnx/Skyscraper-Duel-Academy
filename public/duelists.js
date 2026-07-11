// ═══════════════════════════════════════════════════════════
// YGO SKYSCRAPER — DUELISTS.JS
// Firebase-powered duelists page
// ═══════════════════════════════════════════════════════════

import { injectNav, injectModals } from './nav.js';
import { fbGet, fbSet, fbListen, fbRemove, PATHS } from './api.js';

// ── State ──────────────────────────────────────────────────
let duelists   = [];
let archetypes = [];
let tickets    = [];
let dlFilter   = 'all';

// ── Init ──────────────────────────────────────────────────
injectNav('duelists.html');
injectModals();

// ── Firebase listeners ─────────────────────────────────────
fbListen(PATHS.duelists, val => {
  duelists = val ? Object.values(val) : [];
  renderDuelists();
});

fbListen(PATHS.archetypes, val => {
  archetypes = val ? Object.values(val) : INITIAL_ARCHETYPES;
  renderDuelists();
});

fbListen(PATHS.tickets, val => {
  tickets = val ? Object.values(val) : INITIAL_TICKETS;
});

// ── Seed Firebase if empty ─────────────────────────────────
fbGet(PATHS.duelists).then(val => {
  if (!val) {
    const obj = {};
    INITIAL_DUELISTS.forEach(d => { obj[d.id] = d; });
    fbSet(PATHS.duelists, obj);
  }
});
fbGet(PATHS.archetypes).then(val => {
  if (!val) {
    const obj = {};
    INITIAL_ARCHETYPES.forEach(a => { obj[a.id] = a; });
    fbSet(PATHS.archetypes, obj);
  }
});
fbGet(PATHS.tickets).then(val => {
  if (!val) {
    const obj = {};
    INITIAL_TICKETS.forEach((t,i) => { obj['t'+(i+1)] = {...t, id:'t'+(i+1)}; });
    fbSet(PATHS.tickets, obj);
  }
});

// ── Filter ─────────────────────────────────────────────────
window.setDlFilter = function(f, btn) {
  dlFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  renderDuelists();
};

// ── Render ─────────────────────────────────────────────────
function renderDuelists() {
  const q     = (document.getElementById('dl-search')?.value || '').toLowerCase();
  const sort  = document.getElementById('dl-sort')?.value || 'dorm';
  const admin = isAdminLoggedIn();

  let list = duelists.filter(d => {
    if (!d.name.toLowerCase().includes(q)) return false;
    const effectiveDorm = d.dorm || 'unassigned';
    if (dlFilter !== 'all' && effectiveDorm !== dlFilter) return false;
    return true;
  });

  if (sort === 'dp')   list.sort((a,b) => b.dp - a.dp);
  if (sort === 'name') list.sort((a,b) => a.name.localeCompare(b.name));
  if (sort === 'dorm') list.sort((a,b) => a.dorm.localeCompare(b.dorm));

  const countEl = document.getElementById('dl-count');
  if (countEl) countEl.textContent = list.length + ' duelist' + (list.length !== 1 ? 's' : '');

  const root = document.getElementById('duelists-root');
  if (!root) return;

  if (!list.length) {
    root.innerHTML = `<div class="empty-state"><div class="icon">👥</div><p>No duelists found.</p></div>`;
    return;
  }

  if (sort === 'dorm') {
    // Group by dorm
    let html = '';
    ['obelisk','ra','slifer','unassigned'].forEach(dorm => {
      const dp = dorm === 'unassigned'
        ? list.filter(d => !d.dorm || d.dorm === 'unassigned')
        : list.filter(d => d.dorm === dorm);
      if (!dp.length && dlFilter !== 'all') return;
      if (dorm === 'unassigned' && !dp.length) return; // don't show an empty Unassigned section by default
      const c = DORM_COLOR[dorm];
      html += `
        <div class="subsection">
          <div style="font-family:'Cinzel',serif;color:${c};font-size:1rem;font-weight:700;
                      margin-bottom:14px;display:flex;align-items:center;gap:8px;">
            ${DORM_ICON[dorm]} ${DORM_NAME[dorm]}
            <span style="color:var(--muted);font-size:0.76rem;font-family:'Exo 2',sans-serif;font-weight:400;">
              (${dp.length})
            </span>
          </div>
          <div class="grid-3">${dp.map(d => buildCard(d, admin)).join('')}
            ${admin && dorm === 'unassigned' ? `<button class="add-card-btn" onclick="openAddDuelist()">+ Add to ${DORM_NAME[dorm]}</button>` : ''}
          </div>
        </div>`;
    });
    root.innerHTML = html;
  } else {
    root.innerHTML = `<div class="grid-3">${list.map(d => buildCard(d, admin)).join('')}</div>`;
  }
}

// ── Build card ─────────────────────────────────────────────
function buildCard(d, admin) {
  const c = DORM_COLOR[d.dorm || 'unassigned'];

  const titleHtml = (d.titles||[])
    .map(t => `<span class="title-chip t-${t.replace(/\s+/g,'-')}" title="${(TITLE_BENEFITS[t]||'').replace(/"/g,'&quot;')}">${TITLE_ICON[t]||''} ${t}</span>`)
    .join('');

  const slots = ['','','',''];
  (d.archs||[]).forEach((a,i) => { if(i<4) slots[i]=a; });
  const archHtml = slots.map(a => a
    ? `<span class="arch-slot filled">🃏 ${a}</span>`
    : `<span class="arch-slot empty">— empty —</span>`
  ).join('');

  const dTickets = d.tickets || [];
  const ticketHtml = dTickets.length
    ? dTickets.map((t,i) => `
        <span style="background:rgba(26,92,59,0.15);border:1px solid rgba(26,92,59,0.4);
                     border-radius:14px;padding:2px 9px;font-size:0.72rem;color:#4FD49A;
                     display:inline-flex;align-items:center;gap:4px;margin:1px;">
          ${t}
        </span>`).join('')
    : `<span style="color:var(--faint);font-size:0.74rem;font-style:italic;">No tickets</span>`;

  return `
    <a href="profile.html?id=${d.id}" class="duelist-card" style="border-color:${c}33;display:block;text-decoration:none;color:inherit;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:2px;">
        ${d.profilePicUrl
          ? `<img src="${d.profilePicUrl}" alt="${d.name}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid ${c};flex-shrink:0;"/>`
          : `<div style="width:36px;height:36px;border-radius:50%;border:1px solid var(--border);background:var(--surface2);
              display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:var(--muted);flex-shrink:0;">👤</div>`
        }
        <span style="font-family:'Cinzel',serif;font-weight:700;font-size:0.95rem;">${d.name}</span>
      </div>
      <div style="font-size:0.68rem;color:${c};font-weight:700;letter-spacing:0.5px;margin-bottom:3px;">
        ${DORM_ICON[d.dorm || 'unassigned']} ${DORM_NAME[d.dorm || 'unassigned']}
      </div>
      <div style="font-size:0.82rem;color:var(--gold);font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        💰 ${d.dp.toLocaleString()} DP
        <span style="color:var(--muted);font-weight:400;font-size:0.72rem;">
          &nbsp;·&nbsp; ${(d.archs||[]).length}/4 slots
        </span>
      </div>
      ${titleHtml ? `<div style="margin-bottom:7px;">${titleHtml}</div>` : ''}
      <div style="margin-bottom:10px;">${archHtml}</div>
      <div style="border-top:1px solid var(--border);padding-top:8px;">
        <div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:0.5px;
                    color:var(--muted);margin-bottom:5px;display:flex;align-items:center;
                    justify-content:space-between;">
          <span>🎫 Tickets</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:2px;">${ticketHtml}</div>
      </div>
    </a>`;
}

// ── Open ADD ───────────────────────────────────────────────
window.openAddDuelist = function() {
  document.getElementById('d-name').value = '';
  openModal('modal-duelist');
};

// ── Submit ─────────────────────────────────────────────────
window.submitDuelist = async function() {
  const name = document.getElementById('d-name').value.trim();
  if (!name) { notify('⚠️ Name is required'); return; }

  const newId = 'd' + Date.now();
  await fbSet(PATHS.duelists + '/' + newId, {
    id: newId, name, dorm: 'unassigned', dp: 0, archs: [], titles: [], tickets: [],
  });

  closeModal('modal-duelist');
  notify('✅ Duelist added — set up their dorm, DP, and roles from their profile.');
};

// ── Admin change ───────────────────────────────────────────
window.onAdminChange = function() { renderDuelists(); };