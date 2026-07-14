// ═══════════════════════════════════════════════════════════
// YGO SKYSCRAPER — HOME.JS
// ═══════════════════════════════════════════════════════════

import { injectNav, injectModals } from './nav.js';
import { fbGet, fbSet, fbListen, PATHS } from './api.js';
// DORM_ICON, DORM_COLOR, TITLE_LIST, TITLE_ICON, DEFAULT_ANNOUNCEMENT,
// isAdminLoggedIn, notify come from data.js, loaded as a plain global
// script in index.html (see the <script src="data.js" defer> tag).

// ── Init ──────────────────────────────────────────────────
injectNav('index.html');
injectModals();

// ── Listeners ─────────────────────────────────────────────
fbListen(PATHS.announcement, val => {
  const el = document.getElementById('announce-text');
  if (el) el.textContent = val || DEFAULT_ANNOUNCEMENT;
});

fbListen(PATHS.duelists, val => {
  const duelists = val ? Object.values(val) : [];
  renderDormStrip(duelists);
  renderTop5(duelists);
  renderHallOfTitles(duelists);
});

fbListen(PATHS.exams, val => {
  const exams = val ? Object.values(val) : [];
  renderHint(exams);
});

fbListen(PATHS.wheelResult, val => {
  const el = document.getElementById('home-wheel-result');
  if (el) el.textContent = val ? '🏆 ' + val.result : 'No spin yet';
});

// ── Announcement ───────────────────────────────────────────
window.startAnnounce = async function() {
  const val = await fbGet(PATHS.announcement);
  document.getElementById('announce-ta').value = val || DEFAULT_ANNOUNCEMENT;
  document.getElementById('announce-text').style.display = 'none';
  document.getElementById('announce-edit').style.display = 'block';
};
window.cancelAnnounce = function() {
  document.getElementById('announce-text').style.display = '';
  document.getElementById('announce-edit').style.display = 'none';
};
window.saveAnnounce = async function() {
  const val = document.getElementById('announce-ta').value;
  await fbSet(PATHS.announcement, val);
  cancelAnnounce();
  notify('✅ Announcement saved');
};

// ── Dorm strip ─────────────────────────────────────────────
function renderDormStrip(duelists) {
  ['obelisk','ra','slifer'].forEach(d => {
    const dp  = duelists.filter(x => x.dorm === d);
    const c   = DORM_COLOR[d];
    const cel = document.getElementById('count-' + d);
    const lel = document.getElementById('leader-' + d);
    if (cel) cel.textContent = dp.length + ' Duelist' + (dp.length !== 1 ? 's' : '');
    if (lel) {
      const leaders = dp.filter(x => (x.titles||[]).includes('Dorm Leader'));
      lel.innerHTML = leaders.length
        ? '<span style="color:var(--muted);font-size:0.72rem;">Leader: </span>'
          + leaders.map(l => `<a href="profile.html?id=${l.id}" style="color:${c};font-weight:700;text-decoration:none;">${l.name}</a>`).join(', ')
        : '<span style="color:var(--faint);font-size:0.72rem;">No leader assigned</span>';
    }
  });

  const unassignedCount = duelists.filter(x => !x.dorm || x.dorm === 'unassigned').length;
  const uEl = document.getElementById('count-unassigned');
  if (uEl) uEl.textContent = unassignedCount + ' Duelist' + (unassignedCount !== 1 ? 's' : '');
}

// ── Top 5 ──────────────────────────────────────────────────
function renderTop5(duelists) {
  const el = document.getElementById('top5');
  if (!el) return;
  const sorted = [...duelists].sort((a,b) => b.dp - a.dp).slice(0,5);
  el.innerHTML = sorted.length
    ? sorted.map((d,i) => `
        <div class="top5-row">
          <div class="top5-rank">${['🥇','🥈','🥉'][i]||i+1}</div>
          <div class="top5-name"><a href="profile.html?id=${d.id}" style="color:inherit;text-decoration:none;">${d.name}</a> <span>${DORM_ICON[d.dorm || 'unassigned']}</span></div>
          <div class="top5-dp">${d.dp.toLocaleString()} DP</div>
        </div>`).join('')
    : '<div style="color:var(--muted);font-size:0.85rem;padding:8px 0;">No duelists yet.</div>';
}

// ── Hall of Titles ─────────────────────────────────────────
function renderHallOfTitles(duelists) {
  const el = document.getElementById('hall-titles');
  if (!el) return;
  const tm = {};
  TITLE_LIST.forEach(t => tm[t] = []);
  duelists.forEach(d => (d.titles||[]).forEach(t => { if(tm[t]) tm[t].push(d); }));
  const rows = TITLE_LIST.filter(t => tm[t].length > 0).map(t => `
    <div style="margin-bottom:10px;">
      <div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);margin-bottom:4px;">
        ${TITLE_ICON[t]||''} ${t}
      </div>
      <div>${tm[t].map(d=>`<a href="profile.html?id=${d.id}" class="title-chip t-${t.replace(/\s+/g,'-')}" style="text-decoration:none;">${d.name}</a>`).join(' ')}</div>
    </div>`).join('');
  el.innerHTML = rows || '<div style="color:var(--muted);font-size:0.85rem;">No titles assigned yet.</div>';
}

// ── Hint ───────────────────────────────────────────────────
function renderHint(exams) {
  const el = document.getElementById('home-hint');
  if (!el) return;
  const latest = exams.filter(e => e.hint).sort((a,b) => b.id - a.id)[0];
  el.textContent = latest ? '"' + latest.hint + '"' : 'No hint posted yet. Check back soon...';
}

// ── Admin change ───────────────────────────────────────────
window.onAdminChange = function() {
  const eb = document.getElementById('btn-edit-announce');
  if (eb) eb.style.display = isAdminLoggedIn() ? '' : 'none';
};