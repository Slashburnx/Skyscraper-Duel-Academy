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
    if (dlFilter !== 'all' && d.dorm !== dlFilter) return false;
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
    ['obelisk','ra','slifer'].forEach(dorm => {
      const dp = list.filter(d => d.dorm === dorm);
      if (!dp.length && dlFilter !== 'all') return;
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
            ${admin ? `<button class="add-card-btn" onclick="openAddDuelist('${dorm}')">+ Add to ${DORM_NAME[dorm]}</button>` : ''}
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
  const c = DORM_COLOR[d.dorm];

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
          ${admin ? `<button onclick="removeTicketFromDuelist('${d.id}',${i})"
            style="background:none;border:none;color:#4FD49A;cursor:pointer;
                   font-size:0.8rem;line-height:1;padding:0;opacity:0.7;">✕</button>` : ''}
        </span>`).join('')
    : `<span style="color:var(--faint);font-size:0.74rem;font-style:italic;">No tickets</span>`;

  return `
    <div class="duelist-card" style="border-color:${c}33;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;margin-bottom:2px;">
        <div style="font-family:'Cinzel',serif;font-weight:700;font-size:0.95rem;">${d.name}</div>
        ${admin ? `<div style="display:flex;gap:4px;flex-shrink:0;">
          <button class="btn-icon" onclick="openEditDuelist('${d.id}')">✏️</button>
          <button class="btn-icon" style="color:var(--sl);" onclick="deleteDuelist('${d.id}')">✕</button>
        </div>` : ''}
      </div>
      <div style="font-size:0.68rem;color:${c};font-weight:700;letter-spacing:0.5px;margin-bottom:3px;">
        ${DORM_ICON[d.dorm]} ${DORM_NAME[d.dorm]}
      </div>
      <div style="font-size:0.82rem;color:var(--gold);font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        💰 ${d.dp.toLocaleString()} DP
        <span style="color:var(--muted);font-weight:400;font-size:0.72rem;">
          &nbsp;·&nbsp; ${(d.archs||[]).length}/4 slots
        </span>
        ${admin ? `<button class="btn-icon" style="font-size:0.68rem;padding:2px 7px;font-weight:400;"
          onclick="grantDP('${d.id}')">💰 Grant DP</button>` : ''}
        ${admin && (d.titles||[]).includes('Dorm Leader') ? `<button class="btn-icon" style="font-size:0.68rem;padding:2px 7px;font-weight:400;color:var(--sl);"
          onclick="kickMember('${d.id}')">👢 Kick Member</button>` : ''}
      </div>
      ${titleHtml ? `<div style="margin-bottom:7px;">${titleHtml}</div>` : ''}
      <div style="margin-bottom:10px;">${archHtml}</div>
      <div style="border-top:1px solid var(--border);padding-top:8px;">
        <div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:0.5px;
                    color:var(--muted);margin-bottom:5px;display:flex;align-items:center;
                    justify-content:space-between;">
          <span>🎫 Tickets</span>
          ${admin ? `<button class="btn-icon" style="font-size:0.7rem;padding:2px 7px;"
            onclick="openAddTicketToDuelist('${d.id}')">+ Add</button>` : ''}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:2px;">${ticketHtml}</div>
      </div>
    </div>`;
}

// ── Add ticket to duelist ──────────────────────────────────
window.openAddTicketToDuelist = async function(id) {
  document.getElementById('atd-id').value = id;
  const tData = await fbGet(PATHS.tickets);
  const tList = tData ? Object.values(tData) : INITIAL_TICKETS;
  const sel   = document.getElementById('atd-ticket');
  sel.innerHTML = '<option value="">— Select ticket —</option>' +
    tList.map(t =>
      `<option value="${t.name}" ${t.stock <= 0 ? 'disabled' : ''}>
        ${t.name} ${t.stock > 0 ? '('+t.stock+'x left)' : '(out of stock)'}
      </option>`
    ).join('');
  document.getElementById('atd-stock-info').textContent = '';
  sel.onchange = () => {
    const chosen = tList.find(t => t.name === sel.value);
    const info   = document.getElementById('atd-stock-info');
    info.textContent = chosen && chosen.stock > 0
      ? `Stock will reduce from ${chosen.stock} to ${chosen.stock - 1}`
      : chosen ? 'Out of stock' : '';
  };
  openModal('modal-add-ticket-d');
};

window.submitAddTicketToDuelist = async function() {
  const id         = document.getElementById('atd-id').value;
  const ticketName = document.getElementById('atd-ticket').value;
  if (!ticketName) { notify('⚠️ Select a ticket'); return; }

  // Reduce stock in Firebase
  const tData = await fbGet(PATHS.tickets);
  const tList = tData ? Object.values(tData) : [];
  const tEntry = tList.find(t => t.name === ticketName);
  if (tEntry) {
    if (tEntry.stock <= 0) { notify('⚠️ Out of stock'); return; }
    tEntry.stock -= 1;
    const tObj = {};
    tList.forEach(t => { tObj[t.id] = t; });
    await fbSet(PATHS.tickets, tObj);
  }

  // Add to duelist
  const d = duelists.find(x => x.id === id);
  if (d) {
    const updated = { ...d, tickets: [...(d.tickets||[]), ticketName] };
    await fbSet(PATHS.duelists + '/' + id, updated);
  }

  closeModal('modal-add-ticket-d');
  notify(`✅ ${ticketName} added`);
};

// ── Remove ticket from duelist ─────────────────────────────
window.removeTicketFromDuelist = async function(duelistId, ticketIdx) {
  const d = duelists.find(x => x.id === duelistId);
  if (!d) return;
  const ticketName = (d.tickets||[])[ticketIdx];
  if (!confirm(`Remove "${ticketName}" from ${d.name}?\nThis will add 1 back to shop stock.`)) return;

  // Restore stock
  const tData = await fbGet(PATHS.tickets);
  const tList = tData ? Object.values(tData) : [];
  const tEntry = tList.find(t => t.name === ticketName);
  if (tEntry) {
    tEntry.stock += 1;
    const tObj = {};
    tList.forEach(t => { tObj[t.id] = t; });
    await fbSet(PATHS.tickets, tObj);
  }

  const newTickets = [...(d.tickets||[])];
  newTickets.splice(ticketIdx, 1);
  await fbSet(PATHS.duelists + '/' + duelistId, { ...d, tickets: newTickets });
  notify(`"${ticketName}" removed`);
};

// ── Title checkboxes ───────────────────────────────────────
function buildTitleChecks(current) {
  document.getElementById('d-titles').innerHTML = TITLE_LIST.map(t => `
    <label style="display:flex;align-items:center;gap:5px;font-size:0.78rem;cursor:pointer;
                  padding:3px 8px;border-radius:4px;border:1px solid var(--border);background:var(--surface);"
           title="${(TITLE_BENEFITS[t]||'').replace(/"/g,'&quot;')}">
      <input type="checkbox" value="${t}" ${(current||[]).includes(t) ? 'checked' : ''}/>
      ${TITLE_ICON[t]||''} ${t}
    </label>`).join('');
}

function getTitleValues() {
  return [...document.querySelectorAll('#d-titles input:checked')].map(x => x.value);
}

// ── Arch slot dropdowns ────────────────────────────────────
function buildArchSlots(current, editId) {
  const allArchs = archetypes
    .filter(a => a.status !== 'Unavailable')
    .map(a => a.name).sort();

  const takenBy = {};
  duelists.forEach(d => {
    if (d.id === editId) return;
    (d.archs||[]).forEach(a => {
      takenBy[a] = takenBy[a] || [];
      takenBy[a].push(d.name);
    });
  });

  document.getElementById('d-slots').innerHTML = [0,1,2,3].map(i => {
    const cur = (current||[])[i] || '';
    const opts = allArchs.map(a => {
      const taken = takenBy[a]?.length > 0 && !(current||[]).includes(a);
      return `<option value="${a}" ${cur===a?'selected':''} ${taken?'style="color:var(--muted);"':''}>
        ${a}${taken?' (taken)':''}
      </option>`;
    }).join('');
    return `
      <div class="slot-row">
        <span class="slot-label">Slot ${i+1}</span>
        <select class="form-ctrl" id="d-slot-${i}" onchange="dedupeSlots()"
          style="font-size:0.82rem;padding:6px 10px;">
          <option value="">— Empty —</option>${opts}
        </select>
      </div>`;
  }).join('');
}

window.dedupeSlots = function() {
  const vals = [0,1,2,3].map(i => document.getElementById('d-slot-'+i)?.value || '');
  const seen = new Set();
  [0,1,2,3].forEach(i => {
    const el = document.getElementById('d-slot-'+i);
    if (!el?.value) return;
    if (seen.has(el.value)) el.value = '';
    else seen.add(el.value);
  });
};

function getSlotValues() {
  return [0,1,2,3].map(i => document.getElementById('d-slot-'+i)?.value || '').filter(Boolean);
}

// ── Open ADD ───────────────────────────────────────────────
window.openAddDuelist = function(dorm) {
  document.getElementById('modal-d-title').textContent = 'Add Duelist';
  document.getElementById('d-id').value   = '';
  document.getElementById('d-name').value = '';
  document.getElementById('d-dorm').value = dorm || 'slifer';
  document.getElementById('d-dp').value   = '';
  buildTitleChecks([]);
  buildArchSlots([], null);
  openModal('modal-duelist');
};

// ── Open EDIT ──────────────────────────────────────────────
window.openEditDuelist = function(id) {
  const d = duelists.find(x => x.id === id);
  if (!d) return;
  document.getElementById('modal-d-title').textContent = 'Edit Duelist';
  document.getElementById('d-id').value   = id;
  document.getElementById('d-name').value = d.name;
  document.getElementById('d-dorm').value = d.dorm;
  document.getElementById('d-dp').value   = d.dp;
  buildTitleChecks(d.titles||[]);
  buildArchSlots(d.archs||[], id);
  openModal('modal-duelist');
};

// ── Submit ─────────────────────────────────────────────────
window.submitDuelist = async function() {
  const name = document.getElementById('d-name').value.trim();
  if (!name) { notify('⚠️ Name is required'); return; }

  const id     = document.getElementById('d-id').value;
  const dorm   = document.getElementById('d-dorm').value;
  const dp     = parseInt(document.getElementById('d-dp').value) || 0;
  const archs  = getSlotValues();
  const titles = getTitleValues();

  if (id) {
    const existing = duelists.find(d => d.id === id);
    await fbSet(PATHS.duelists + '/' + id, { ...existing, name, dorm, dp, archs, titles });
  } else {
    const newId = 'd' + Date.now();
    await fbSet(PATHS.duelists + '/' + newId, { id: newId, name, dorm, dp, archs, titles, tickets: [] });
  }

  closeModal('modal-duelist');
  notify('✅ Duelist saved');
};

// ── Delete ─────────────────────────────────────────────────
window.deleteDuelist = async function(id) {
  if (!confirm('Remove this duelist?')) return;
  await fbRemove(PATHS.duelists + '/' + id);
  notify('Duelist removed');
};

// ── Grant DP (Gambler role auto-doubles the amount) ─────────
window.grantDP = async function(id) {
  const d = duelists.find(x => x.id === id);
  if (!d) return;

  const input = prompt(`Grant DP to ${d.name}\nEnter the base amount:`);
  if (input === null) return;
  const amount = parseInt(input, 10);
  if (!amount || amount <= 0) { notify('⚠️ Enter a valid amount'); return; }

  const isGambler   = (d.titles||[]).includes('Gambler');
  const finalAmount = isGambler ? amount * 2 : amount;
  const newDp       = (d.dp||0) + finalAmount;

  await fbSet(PATHS.duelists + '/' + id, { ...d, dp: newDp });

  notify(isGambler
    ? `🎰 ${d.name} is a Gambler — ${amount.toLocaleString()} DP doubled to ${finalAmount.toLocaleString()}! New total: ${newDp.toLocaleString()}`
    : `✅ Granted ${finalAmount.toLocaleString()} DP to ${d.name}. New total: ${newDp.toLocaleString()}`);
};

// ── Dorm Leader: kick a member (once per month) ──────────────
const KICK_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

window.kickMember = async function(leaderId) {
  const leader = duelists.find(x => x.id === leaderId);
  if (!leader) return;
  if (!(leader.titles||[]).includes('Dorm Leader')) {
    notify('⚠️ Only a Dorm Leader can do this');
    return;
  }

  const sinceLastKick = Date.now() - (leader.lastKickAt || 0);
  if (sinceLastKick < KICK_COOLDOWN_MS) {
    const daysLeft = Math.ceil((KICK_COOLDOWN_MS - sinceLastKick) / (24*60*60*1000));
    notify(`⚠️ ${leader.name} already used this month's kick. ${daysLeft} day(s) left.`);
    return;
  }

  const sameDorm = duelists.filter(d => d.dorm === leader.dorm && d.id !== leader.id);
  if (!sameDorm.length) { notify('⚠️ No other members in this dorm'); return; }

  const names  = sameDorm.map((d,i) => `${i+1}. ${d.name}`).join('\n');
  const choice = prompt(`${leader.name} (Dorm Leader) is kicking a member.\nEnter a number:\n${names}`);
  if (choice === null) return;
  const target = sameDorm[parseInt(choice, 10) - 1];
  if (!target) { notify('⚠️ Invalid selection'); return; }

  if (!confirm(`Kick ${target.name} from the dorm?\nThey lose 10,000 DP, 1 archetype, and move to a random different dorm.`)) return;

  // Remove one archetype — ask which, if they have more than one.
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
  const newDorm     = otherDorms[Math.floor(Math.random() * otherDorms.length)];
  const newDp       = Math.max(0, (target.dp||0) - 10000);

  await fbSet(PATHS.duelists + '/' + target.id, { ...target, dp: newDp, archs: remainingArchs, dorm: newDorm });
  await fbSet(PATHS.duelists + '/' + leader.id, { ...leader, lastKickAt: Date.now() });

  notify(`👢 ${target.name} kicked: -10,000 DP${removedArch ? ', lost ' + removedArch : ''}, moved to ${DORM_NAME[newDorm]}.`);
};

// ── Admin change ───────────────────────────────────────────
window.onAdminChange = function() { renderDuelists(); };