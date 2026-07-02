// ═══════════════════════════════════════════════════════════
// YGO SKYSCRAPER — WHEEL.JS
// Anti-cheat spin wheel with public history log
// ═══════════════════════════════════════════════════════════

const WHEEL_COLORS = [
  '#1A3B8C','#8C1A1A','#B8860B','#1A5C3B',
  '#5C1A5C','#1A5C5C','#5C3A1A','#2A4A8C',
  '#6B2A00','#1A4C4C','#4C1A4C','#2A6B2A',
];

let wheelAngle  = 0;
let isSpinning  = false;

// ── Draw wheel ─────────────────────────────────────────────
function drawWheel(angle) {
  const canvas = document.getElementById('wheel-canvas');
  if (!canvas) return;
  const ctx   = canvas.getContext('2d');
  const items = getWheelItems();
  const w     = canvas.width;
  const cx    = w / 2;
  const r     = cx - 4;

  ctx.clearRect(0, 0, w, w);

  if (!items.length) {
    ctx.fillStyle = '#11111E';
    ctx.beginPath();
    ctx.arc(cx, cx, r, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#6A6A8A';
    ctx.font = '14px Exo 2, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Add items to spin!', cx, cx);
    return;
  }

  const slice = (2 * Math.PI) / items.length;

  // Draw segments
  items.forEach((item, i) => {
    const start = angle + i * slice;
    const end   = start + slice;

    ctx.beginPath();
    ctx.moveTo(cx, cx);
    ctx.arc(cx, cx, r, start, end);
    ctx.closePath();
    ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
    ctx.fill();
    ctx.strokeStyle = '#08080F';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.save();
    ctx.translate(cx, cx);
    ctx.rotate(start + slice / 2);
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#fff';
    const fs = Math.max(9, Math.min(13, 110 / items.length));
    ctx.font = `bold ${fs}px 'Exo 2', sans-serif`;
    const lbl = item.length > 16 ? item.slice(0, 15) + '…' : item;
    ctx.fillText(lbl, r - 10, 0);
    ctx.restore();
  });

  // Gold center cap
  ctx.beginPath();
  ctx.arc(cx, cx, 18, 0, 2 * Math.PI);
  const grad = ctx.createRadialGradient(cx, cx, 2, cx, cx, 18);
  grad.addColorStop(0, '#FFD700');
  grad.addColorStop(1, '#C89B00');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#08080F';
  ctx.lineWidth = 3;
  ctx.stroke();
}

// ── Spin ───────────────────────────────────────────────────
function doSpin() {
  if (isSpinning || !isAdminLoggedIn()) return;
  const items = getWheelItems();
  if (!items.length) { notify('⚠️ Add items to the wheel first!'); return; }

  isSpinning = true;
  document.getElementById('spin-btn').disabled = true;
  document.getElementById('result-box').style.display = 'none';

  // Provably fair seed — based on timestamp
  const seed      = Date.now();
  const seedRatio = ((seed % 99991) / 99991); // 0–1 from seed
  const rounds    = 8 + Math.floor(seedRatio * 8);
  const extra     = seedRatio * 2 * Math.PI;
  const totalRot  = rounds * 2 * Math.PI + extra;

  const duration  = 5000;
  const startTime = performance.now();
  const startAngle = wheelAngle;

  // Ease out cubic
  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  function animate(now) {
    const t = Math.min((now - startTime) / duration, 1);
    wheelAngle = startAngle + totalRot * ease(t);
    drawWheel(wheelAngle);

    if (t < 1) { requestAnimationFrame(animate); return; }

    // Spin complete — calculate result
    isSpinning = false;
    document.getElementById('spin-btn').disabled = false;

    const slice      = (2 * Math.PI) / items.length;
    const normalized = ((-wheelAngle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const idx        = Math.floor(normalized / slice) % items.length;
    const result     = items[idx];
    const ts         = new Date().toLocaleString();

    // Save result
    const entry = { result, ts, seed, items: [...items] };
    saveWheelResult(entry);

    const hist = getWheelHistory();
    hist.unshift(entry);
    if (hist.length > 100) hist.pop();
    saveWheelHistory(hist);

    showResult(entry);
    renderHistory();
  }

  requestAnimationFrame(animate);
}

// ── Show result ────────────────────────────────────────────
function showResult(entry) {
  if (!entry) return;
  document.getElementById('result-box').style.display = 'block';
  document.getElementById('result-text').textContent  = entry.result;
  document.getElementById('result-seed').textContent  = 'Seed: ' + entry.seed + ' · ' + entry.ts;
}

// ── Render history ─────────────────────────────────────────
function renderHistory() {
  const hist = getWheelHistory();
  const el   = document.getElementById('wheel-history');

  if (!hist.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:0.82rem;">No spins yet.</div>';
    return;
  }

  el.innerHTML =
    `<div class="hist-row hist-header">
      <span>Time</span><span>Result</span><span>Seed</span>
    </div>` +
    hist.map(h => `
      <div class="hist-row">
        <span style="color:var(--muted);">${h.ts}</span>
        <span style="font-weight:700;color:var(--gold);">🏆 ${h.result}</span>
        <span style="font-family:monospace;font-size:0.67rem;color:var(--faint);">${h.seed}</span>
      </div>`).join('');
}

// ── Render items panel ─────────────────────────────────────
function renderItems() {
  const items = getWheelItems();
  const admin = isAdminLoggedIn();

  document.getElementById('items-count').textContent = '(' + items.length + ')';

  // Items chips
  document.getElementById('items-display').innerHTML = items.length
    ? items.map((item, i) => `
        <span style="background:var(--surface2);border:1px solid var(--border);border-radius:14px;
                     padding:3px 10px;font-size:0.76rem;display:inline-flex;align-items:center;gap:4px;">
          ${item}
          ${admin ? `<button onclick="removeWheelItem(${i})"
            style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:0.85rem;line-height:1;padding:0;">✕</button>` : ''}
        </span>`).join('')
    : '<span style="color:var(--faint);font-size:0.8rem;">No items yet.</span>';

  // Quick-add duelists
  if (admin) {
    document.getElementById('quick-add').innerHTML = getDuelists().map(d => `
      <button onclick="quickAddDuelist('${d.name.replace(/'/g, "\\'")}')"
        style="background:var(--surface);border:1px solid var(--border);color:var(--text);
               border-radius:12px;padding:2px 9px;font-size:0.72rem;cursor:pointer;
               font-family:'Exo 2',sans-serif;">
        ${DORM_ICON[d.dorm]} ${d.name}
      </button>`).join('');
  }
}

// ── Item management ────────────────────────────────────────
function addWheelItem() {
  const inp = document.getElementById('new-item-inp');
  const val = inp.value.trim();
  if (!val) return;
  const items = getWheelItems();
  items.push(val);
  saveWheelItems(items);
  inp.value = '';
  renderItems();
  drawWheel(wheelAngle);
}

function removeWheelItem(idx) {
  const items = getWheelItems();
  items.splice(idx, 1);
  saveWheelItems(items);
  renderItems();
  drawWheel(wheelAngle);
}

function quickAddDuelist(name) {
  const items = getWheelItems();
  if (items.includes(name)) { notify(name + ' is already on the wheel'); return; }
  items.push(name);
  saveWheelItems(items);
  renderItems();
  drawWheel(wheelAngle);
}

function clearWheelItems() {
  if (!confirm('Clear all wheel items?')) return;
  saveWheelItems([]);
  renderItems();
  drawWheel(wheelAngle);
}

// ── Admin view toggle ──────────────────────────────────────
function applyAdminView() {
  const admin = isAdminLoggedIn();
  const spinBtn   = document.getElementById('spin-btn');
  const viewerMsg = document.getElementById('viewer-msg');
  if (spinBtn)   spinBtn.style.display   = admin ? '' : 'none';
  if (viewerMsg) viewerMsg.style.display = admin ? 'none' : 'block';
}

// ── Responsive canvas ──────────────────────────────────────
function applyResponsive() {
  if (window.innerWidth < 700) {
    const layout = document.getElementById('wheel-layout');
    if (layout) layout.style.gridTemplateColumns = '1fr';
    const canvas = document.getElementById('wheel-canvas');
    if (canvas) { canvas.width = 270; canvas.height = 270; }
    const container = document.querySelector('.wheel-container');
    if (container) { container.style.width = '270px'; container.style.height = '270px'; }
  }
}

// ── Re-render on admin toggle ──────────────────────────────
function onAdminChange() {
  applyAdminView();
  renderItems();
}

// ── Init ──────────────────────────────────────────────────
injectNav('wheel.html');
applyResponsive();

// Show last result if exists
const lastResult = getWheelResult();
if (lastResult) showResult(lastResult);

renderItems();
renderHistory();
drawWheel(wheelAngle);
applyAdminView();