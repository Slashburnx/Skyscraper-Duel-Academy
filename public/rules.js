// ═══════════════════════════════════════════════════════════
// YGO SKYSCRAPER — RULES.JS
// ═══════════════════════════════════════════════════════════

// ── Render rules list ──────────────────────────────────────
function renderRules() {
  const rules = getRules();
  const admin = isAdminLoggedIn();
  const el    = document.getElementById('rules-list');

  if (!rules.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="icon">📖</div>
        <p>No rules posted yet. The mod can add sections.</p>
      </div>`;
    return;
  }

  el.innerHTML = rules.map(r => `
    <div class="rule-section">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px;">
        <h3>${r.title}</h3>
        ${admin ? `
          <div style="display:flex;gap:4px;flex-shrink:0;">
            <button class="btn-icon" onclick="openEditRule(${r.id})">✏️</button>
            <button class="btn-icon" style="color:var(--sl);" onclick="deleteRule(${r.id})">✕</button>
          </div>` : ''}
      </div>
      <div class="rule-body">${r.body}</div>
    </div>`).join('');
}

// ── Open ADD modal ─────────────────────────────────────────
function openAddRule() {
  document.getElementById('modal-rule-title').textContent = 'Add Section';
  document.getElementById('ru-id').value    = '';
  document.getElementById('ru-title').value = '';
  document.getElementById('ru-body').value  = '';
  openModal('modal-rule');
  setTimeout(() => document.getElementById('ru-title').focus(), 80);
}

// ── Open EDIT modal ────────────────────────────────────────
function openEditRule(id) {
  const r = getRules().find(x => x.id === id);
  if (!r) return;
  document.getElementById('modal-rule-title').textContent = 'Edit Section';
  document.getElementById('ru-id').value    = id;
  document.getElementById('ru-title').value = r.title;
  document.getElementById('ru-body').value  = r.body;
  openModal('modal-rule');
}

// ── Submit ─────────────────────────────────────────────────
function submitRule() {
  const title = document.getElementById('ru-title').value.trim();
  const body  = document.getElementById('ru-body').value.trim();
  if (!title) { notify('⚠️ Title is required'); return; }

  const rules = getRules();
  const id    = parseInt(document.getElementById('ru-id').value) || 0;

  if (id) {
    const idx = rules.findIndex(r => r.id === id);
    if (idx > -1) { rules[idx].title = title; rules[idx].body = body; }
  } else {
    rules.push({ id: Date.now(), title, body });
  }

  saveRules(rules);
  closeModal('modal-rule');
  notify('✅ Section saved');
  renderRules();
}

// ── Delete ─────────────────────────────────────────────────
function deleteRule(id) {
  if (!confirm('Delete this section?')) return;
  saveRules(getRules().filter(r => r.id !== id));
  notify('Section deleted');
  renderRules();
}

// ── Re-render on admin toggle ──────────────────────────────
function onAdminChange() { renderRules(); }

// ── Init ──────────────────────────────────────────────────
injectNav('rules.html');
renderRules();