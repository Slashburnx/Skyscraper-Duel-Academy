// ═══════════════════════════════════════════════════════════
// YGO SKYSCRAPER — DECKLISTS.JS
// Read-only view of all duelists and their archetypes
// ═══════════════════════════════════════════════════════════

let dlFilter = 'all';

// ── Filter setter ──────────────────────────────────────────
function setDlFilter(f, btn) {
  dlFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  renderDecklists();
}

// ── Main render ────────────────────────────────────────────
function renderDecklists() {
  const q    = (document.getElementById('dl-search').value || '').toLowerCase();
  const sort = document.getElementById('dl-sort').value;

  let duelists = getDuelists().filter(d => {
    if (!d.name.toLowerCase().includes(q)) return false;
    if (dlFilter !== 'all' && d.dorm !== dlFilter) return false;
    return true;
  });

  // Sort
  if (sort === 'dp')   duelists.sort((a,b) => b.dp - a.dp);
  if (sort === 'name') duelists.sort((a,b) => a.name.localeCompare(b.name));

  // Count
  document.getElementById('dl-count').textContent = duelists.length + ' duelist' + (duelists.length !== 1 ? 's' : '');

  const grid = document.getElementById('dl-grid');

  if (!duelists.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="icon">📋</div>
        <p>No duelists found.</p>
      </div>`;
    return;
  }

  grid.innerHTML = duelists.map(d => {
    const c = DORM_COLOR[d.dorm];

    // Title chips
    const titleHtml = (d.titles || [])
      .map(t => `<span class="title-chip t-${t.replace(/\s+/g,'-')}">${TITLE_ICON[t]||''} ${t}</span>`)
      .join('');

    // Archetype list
    const archHtml = (d.archs && d.archs.length)
      ? d.archs.map(a => `
          <div style="font-size:0.78rem;padding:4px 0;border-bottom:1px solid rgba(37,37,56,0.4);
                      display:flex;align-items:center;gap:6px;">
            <span style="color:var(--gold);">🃏</span>
            <span>${a}</span>
          </div>`).join('')
      : `<div style="font-size:0.76rem;color:var(--faint);font-style:italic;padding:4px 0;">
           No archetypes held
         </div>`;

    return `
      <div class="card card-hover" style="border-color:${c}33;">

        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px;">
          <div style="font-family:'Cinzel',serif;font-weight:700;font-size:0.95rem;">${d.name}</div>
          <div style="font-size:1.3rem;">${DORM_ICON[d.dorm]}</div>
        </div>

        <!-- Dorm label -->
        <div style="font-size:0.68rem;color:${c};font-weight:700;letter-spacing:0.5px;margin-bottom:4px;">
          ${DORM_NAME[d.dorm]}
        </div>

        <!-- DP -->
        <div style="font-size:0.82rem;color:var(--gold);font-weight:700;margin-bottom:6px;">
          💰 ${d.dp.toLocaleString()} DP
          <span style="color:var(--muted);font-weight:400;font-size:0.72rem;">
            &nbsp;·&nbsp; ${(d.archs||[]).length}/4 slots
          </span>
        </div>

        <!-- Titles -->
        ${titleHtml ? `<div style="margin-bottom:8px;">${titleHtml}</div>` : ''}

        <!-- Archetypes -->
        <div style="border-top:1px solid var(--border);padding-top:8px;margin-top:4px;">
          ${archHtml}
        </div>

      </div>`;
  }).join('');
}

// ── Re-render on admin toggle (read-only page, but keep consistent) ──
function onAdminChange() { renderDecklists(); }

// ── Init ──────────────────────────────────────────────────
injectNav('decklists.html');
renderDecklists();