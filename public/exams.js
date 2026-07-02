// ═══════════════════════════════════════════════════════════
// YGO SKYSCRAPER — EXAMS.JS
// ═══════════════════════════════════════════════════════════

// ── Hint ───────────────────────────────────────────────────
function renderHint() {
  const exams  = getExams().filter(e => e.hint).sort((a,b) => b.id - a.id);
  const latest = exams[0];
  document.getElementById('hint-display').textContent = latest
    ? '"' + latest.hint + '"'
    : 'No hint posted yet. Check back soon...';
}

function startHint() {
  const exams  = getExams().filter(e => e.hint).sort((a,b) => b.id - a.id);
  document.getElementById('hint-ta').value = exams[0] ? exams[0].hint : '';
  document.getElementById('hint-display').style.display = 'none';
  document.getElementById('hint-edit').style.display    = 'block';
}

function cancelHint() {
  document.getElementById('hint-display').style.display = '';
  document.getElementById('hint-edit').style.display    = 'none';
}

function saveHint() {
  const hint  = document.getElementById('hint-ta').value.trim();
  const exams = getExams();
  if (exams.length) {
    exams.sort((a,b) => b.id - a.id);
    exams[0].hint = hint;
    saveExams(exams);
  } else {
    exams.push({ id: Date.now(), title:'Hint', theme:'', date:'', hint, scores:[] });
    saveExams(exams);
  }
  cancelHint();
  renderHint();
  notify('✅ Hint saved');
}

// ── Exam list ──────────────────────────────────────────────
function renderExams() {
  renderHint();
  const exams = getExams().sort((a,b) => b.id - a.id);
  const admin = isAdminLoggedIn();
  const el    = document.getElementById('exams-list');

  if (!exams.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="icon">📝</div>
        <p>No exams recorded yet.</p>
      </div>`;
    return;
  }

  el.innerHTML = exams.map(ex => {
    // Results table
    let resultsHtml = '';
    if (ex.scores && ex.scores.length) {
      const rows = ex.scores.map(s => {
        const total = EXAM_TYPES.reduce((sum, t) => sum + (parseFloat((s.pts||{})[t]) || 0), 0);
        const passBadge = s.pass === true
          ? '<span class="badge b-green">✅ Pass</span>'
          : s.pass === false
            ? '<span class="badge b-red">❌ Fail</span>'
            : '<span class="badge b-grey">—</span>';
        return `
          <tr>
            <td style="font-weight:600;">${s.name}</td>
            ${EXAM_TYPES.map(t => `<td style="color:var(--gold);">${(s.pts&&s.pts[t]!==undefined&&s.pts[t]!=='') ? s.pts[t] : '—'}</td>`).join('')}
            <td style="color:var(--gold);font-weight:700;">${total || '—'}</td>
            <td>${passBadge}</td>
          </tr>`;
      }).join('');

      resultsHtml = `
        <div style="margin-top:16px;overflow-x:auto;">
          <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);margin-bottom:8px;">Results</div>
          <table class="tbl" style="font-size:0.78rem;">
            <thead>
              <tr>
                <th>Duelist</th>
                ${EXAM_TYPES.map(t => `<th>${t}</th>`).join('')}
                <th>Total</th>
                <th>Pass/Fail</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    return `
      <div class="exam-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
          <div>
            <div class="exam-card-title">${ex.title}</div>
            <span class="exam-theme">🎭 ${ex.theme}</span>
            ${ex.date ? `<span style="color:var(--muted);font-size:0.75rem;margin-left:8px;">${ex.date}</span>` : ''}
          </div>
          ${admin ? `
            <div style="display:flex;gap:4px;">
              <button class="btn-icon" onclick="openEditExam(${ex.id})">✏️</button>
              <button class="btn-icon" style="color:var(--sl);" onclick="deleteExam(${ex.id})">✕</button>
            </div>` : ''}
        </div>
        ${resultsHtml}
      </div>`;
  }).join('');
}

// ── Score input builder ────────────────────────────────────
function buildScoreInputs(existing) {
  const duelists = getDuelists();
  document.getElementById('ex-scores').innerHTML = duelists.map(d => {
    const s   = (existing || []).find(x => x.name === d.name);
    const key = d.name.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
    return `
      <div style="background:var(--surface2);border-radius:6px;padding:10px 12px;">
        <div style="font-weight:700;font-size:0.82rem;margin-bottom:8px;">
          ${d.name}
          <span style="color:${DORM_COLOR[d.dorm]};font-size:0.8rem;margin-left:4px;">${DORM_ICON[d.dorm]}</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
          ${EXAM_TYPES.map(t => {
            const tid = key + '_' + t.replace(/\s+/g,'_');
            const val = s && s.pts && s.pts[t] !== undefined ? s.pts[t] : '';
            return `
              <div style="flex:1;min-width:90px;">
                <label style="font-size:0.67rem;color:var(--muted);display:block;margin-bottom:3px;">${t}</label>
                <input type="number" min="0" class="form-ctrl" id="sc_${tid}"
                  style="padding:5px 8px;font-size:0.8rem;" value="${val}" placeholder="—"/>
              </div>`;
          }).join('')}
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:0.72rem;color:var(--muted);">Pass / Fail:</span>
          <select class="inline-sel" id="pf_${key}">
            <option value="">—</option>
            <option value="pass"  ${s && s.pass === true  ? 'selected' : ''}>✅ Pass</option>
            <option value="fail"  ${s && s.pass === false ? 'selected' : ''}>❌ Fail</option>
          </select>
        </div>
      </div>`;
  }).join('');
}

// ── Open ADD modal ─────────────────────────────────────────
function openAddExam() {
  document.getElementById('modal-exam-title').textContent = 'Add Exam Event';
  document.getElementById('ex-id').value    = '';
  document.getElementById('ex-title').value = '';
  document.getElementById('ex-theme').value = '';
  document.getElementById('ex-date').value  = '';
  document.getElementById('ex-hint').value  = '';
  buildScoreInputs([]);
  openModal('modal-exam');
}

// ── Open EDIT modal ────────────────────────────────────────
function openEditExam(id) {
  const ex = getExams().find(e => e.id === id);
  if (!ex) return;
  document.getElementById('modal-exam-title').textContent = 'Edit Exam Event';
  document.getElementById('ex-id').value    = id;
  document.getElementById('ex-title').value = ex.title  || '';
  document.getElementById('ex-theme').value = ex.theme  || '';
  document.getElementById('ex-date').value  = ex.date   || '';
  document.getElementById('ex-hint').value  = ex.hint   || '';
  buildScoreInputs(ex.scores || []);
  openModal('modal-exam');
}

// ── Submit exam ────────────────────────────────────────────
function submitExam() {
  const title = document.getElementById('ex-title').value.trim();
  if (!title) { notify('⚠️ Title is required'); return; }

  const duelists = getDuelists();
  const scores   = duelists.map(d => {
    const key = d.name.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
    const pts  = {};
    EXAM_TYPES.forEach(t => {
      const el = document.getElementById('sc_' + key + '_' + t.replace(/\s+/g,'_'));
      if (el && el.value !== '') pts[t] = parseFloat(el.value) || 0;
    });
    const pfEl = document.getElementById('pf_' + key);
    const pf   = pfEl ? pfEl.value : '';
    return { name: d.name, pts, pass: pf === 'pass' ? true : pf === 'fail' ? false : null };
  }).filter(s => Object.keys(s.pts).length > 0 || s.pass !== null);

  const exams = getExams();
  const id    = parseInt(document.getElementById('ex-id').value) || 0;
  const entry = {
    title,
    theme  : document.getElementById('ex-theme').value.trim(),
    date   : document.getElementById('ex-date').value,
    hint   : document.getElementById('ex-hint').value.trim(),
    scores,
  };

  if (id) {
    const idx = exams.findIndex(e => e.id === id);
    if (idx > -1) exams[idx] = { ...exams[idx], ...entry };
  } else {
    exams.push({ id: Date.now(), ...entry });
  }

  saveExams(exams);
  closeModal('modal-exam');
  notify('✅ Exam saved');
  renderExams();
}

// ── Delete exam ────────────────────────────────────────────
function deleteExam(id) {
  if (!confirm('Delete this exam record? This cannot be undone.')) return;
  saveExams(getExams().filter(e => e.id !== id));
  notify('Exam deleted');
  renderExams();
}

// ── Re-render on admin toggle ──────────────────────────────
function onAdminChange() { renderExams(); }

// ── Init ──────────────────────────────────────────────────
injectNav('exams.html');
renderExams();