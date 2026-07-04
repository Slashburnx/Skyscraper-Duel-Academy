// ═══════════════════════════════════════════════════════════
// YGO SKYSCRAPER — SHOP.JS
// Mod can add/remove archetypes and tickets, edit ticket stock
// Prices are read-only (managed via Archetypes page)
// ═══════════════════════════════════════════════════════════

// getShopBudget / saveShopBudget / getShopPremium / saveShopPremium
// now come from store.js (backed by the Node.js API), loaded before this file.

// ── Build one archetype row ────────────────────────────────
let myDuelistId = null; // set if a duelist (not admin) is logged into their own account

function buildArchRow(name, section) {
  const archs    = getArchetypes();
  const duelists = getDuelists();
  const admin    = isAdminLoggedIn();
  const a        = archs.find(x => x.name === name) || { price: 0, status: '' };
  const owners   = getArchOwners(name, duelists);
  const taken    = owners.length > 0;
  const unavail  = a.status === 'Unavailable';
  const forbidden = a.status === 'Forbidden';
  const available = !unavail && !forbidden && !taken;

  let statusBadge;
  if (unavail)        statusBadge = '<span class="badge b-grey">Unavailable</span>';
  else if (forbidden) statusBadge = '<span class="badge b-red">Forbidden</span>';
  else if (taken)     statusBadge = `<span class="badge b-red">Sold — ${owners.join(', ')}</span>`;
  else                statusBadge = '<span class="badge b-green">Available</span>';

  const priceCell = (unavail || forbidden)
    ? '<span style="color:var(--muted);">—</span>'
    : `<span style="color:var(--gold);font-weight:600;">${a.price > 0 ? a.price.toLocaleString() + ' DP' : '—'}</span>`;

  const buyButton = (!admin && myDuelistId && available)
    ? `<button class="btn-icon" style="font-size:0.72rem;padding:3px 9px;"
        onclick="requestPurchase('${name.replace(/'/g,"\\'")}')">🛒 Request to Buy</button>`
    : '';

  return `
    <tr>
      <td style="font-weight:600;">${name}</td>
      <td>${priceCell}</td>
      <td>${statusBadge}</td>
      ${admin ? `
        <td>
          <button class="btn-icon" style="color:var(--sl);"
            onclick="removeFromShop('${name.replace(/'/g,"\\'")}','${section}')">✕ Remove</button>
        </td>` : ''}
      ${!admin && myDuelistId ? `<td>${buyButton}</td>` : ''}
    </tr>`;
}

// ── Render budget ──────────────────────────────────────────
function renderBudget() {
  const admin  = isAdminLoggedIn();
  const budget = getShopBudget();
  const ecol   = document.getElementById('budget-edit-col');
  const bcol   = document.getElementById('budget-buy-col');
  if (ecol) ecol.style.display = admin ? '' : 'none';
  if (bcol) bcol.style.display = (!admin && myDuelistId) ? '' : 'none';

  document.getElementById('shop-budget').innerHTML = budget.length
    ? budget.map(n => buildArchRow(n, 'budget')).join('')
    : `<tr><td colspan="4" style="color:var(--muted);font-style:italic;padding:12px;">
         No archetypes in this section right now.
       </td></tr>`;
}

// ── Render premium ─────────────────────────────────────────
function renderPremium() {
  const admin   = isAdminLoggedIn();
  const premium = getShopPremium();
  const ecol    = document.getElementById('premium-edit-col');
  const bcol    = document.getElementById('premium-buy-col');
  if (ecol) ecol.style.display = admin ? '' : 'none';
  if (bcol) bcol.style.display = (!admin && myDuelistId) ? '' : 'none';

  document.getElementById('shop-premium').innerHTML = premium.length
    ? premium.map(n => buildArchRow(n, 'premium')).join('')
    : `<tr><td colspan="4" style="color:var(--muted);font-style:italic;padding:12px;">
         No archetypes in this section right now.
       </td></tr>`;
}

// ── Render tickets ─────────────────────────────────────────
function renderTickets() {
  const admin   = isAdminLoggedIn();
  const tickets = getTickets();
  const ecol    = document.getElementById('ticket-edit-col');
  if (ecol) ecol.style.display = admin ? '' : 'none';

  document.getElementById('shop-tickets').innerHTML = tickets.length
    ? tickets.map((t, i) => `
        <tr>
          <td>
            <div style="font-weight:600;">${t.name}</div>
            ${t.desc ? `<div style="font-size:0.73rem;color:var(--muted);margin-top:2px;line-height:1.4;">${t.desc}</div>` : ''}
          </td>
          <td style="color:var(--gold);font-weight:600;white-space:nowrap;">${t.price}</td>
          <td><span class="badge b-gold">${t.stock}x</span></td>
          ${admin ? `
            <td>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <input type="number" min="0" value="${t.stock}"
                  onchange="updateStock(${i}, this.value)"
                  style="width:60px;background:var(--surface2);border:1px solid var(--border);
                         color:var(--text);padding:4px 8px;border-radius:4px;
                         font-family:'Exo 2',sans-serif;font-size:0.82rem;"/>
                <button class="btn-icon" style="color:var(--sl);"
                  onclick="removeTicket(${i})">✕</button>
              </div>
            </td>` : ''}
        </tr>`).join('')
    : `<tr><td colspan="4" style="color:var(--muted);font-style:italic;padding:12px;">
         No tickets in stock right now.
       </td></tr>`;
}

// ── Remove archetype from shop ─────────────────────────────
function removeFromShop(name, section) {
  if (!confirm(`Remove "${name}" from the shop?`)) return;
  if (section === 'budget') saveShopBudget(getShopBudget().filter(n => n !== name));
  else saveShopPremium(getShopPremium().filter(n => n !== name));
  notify(`"${name}" removed`);
  renderShop();
}

// ── Add archetype modal ────────────────────────────────────
function openAddToShop(section) {
  const current = section === 'budget' ? getShopBudget() : getShopPremium();
  const all     = getArchetypes()
    .filter(a => a.status !== 'Unavailable' && !current.includes(a.name))
    .map(a => a.name).sort();

  document.getElementById('add-shop-section').value = section;
  document.getElementById('add-shop-arch').innerHTML =
    all.length
      ? all.map(n => `<option value="${n}">${n}</option>`).join('')
      : '<option value="">No archetypes available</option>';
  document.getElementById('modal-add-shop-title').textContent =
    section === 'budget' ? 'Add to Budget Section' : 'Add to Premium Section';
  openModal('modal-add-shop');
}

function submitAddToShop() {
  const section = document.getElementById('add-shop-section').value;
  const name    = document.getElementById('add-shop-arch').value;
  if (!name) { notify('Select an archetype'); return; }

  if (section === 'budget') {
    const list = getShopBudget();
    if (!list.includes(name)) { list.push(name); saveShopBudget(list); }
  } else {
    const list = getShopPremium();
    if (!list.includes(name)) { list.push(name); saveShopPremium(list); }
  }
  closeModal('modal-add-shop');
  notify(`✅ "${name}" added to shop`);
  renderShop();
}

// ── Update ticket stock ────────────────────────────────────
function updateStock(idx, val) {
  const tickets = getTickets();
  tickets[idx].stock = Math.max(0, parseInt(val) || 0);
  saveTickets(tickets);
  notify('✅ Stock updated');
  renderTickets();
}

// ── Remove ticket ──────────────────────────────────────────
function removeTicket(idx) {
  const tickets = getTickets();
  if (!confirm(`Remove "${tickets[idx].name}" ticket?`)) return;
  tickets.splice(idx, 1);
  saveTickets(tickets);
  notify('Ticket removed');
  renderTickets();
}

// ── Add ticket modal ───────────────────────────────────────
function openAddTicket() {
  document.getElementById('tk-name').value  = '';
  document.getElementById('tk-price').value = '';
  document.getElementById('tk-desc').value  = '';
  document.getElementById('tk-stock').value = '1';
  openModal('modal-add-ticket');
}

function submitAddTicket() {
  const name  = document.getElementById('tk-name').value.trim();
  const price = document.getElementById('tk-price').value.trim();
  const desc  = document.getElementById('tk-desc').value.trim();
  const stock = parseInt(document.getElementById('tk-stock').value) || 0;

  if (!name)  { notify('⚠️ Name is required'); return; }
  if (!price) { notify('⚠️ Price is required'); return; }

  const tickets = getTickets();
  tickets.push({ name, price, desc, stock });
  saveTickets(tickets);
  closeModal('modal-add-ticket');
  notify(`✅ "${name}" ticket added`);
  renderTickets();
}

// ── Full render ────────────────────────────────────────────
function renderShop() {
  renderBudget();
  renderPremium();
  renderTickets();
}

function onAdminChange() { renderShop(); }

injectNav('shop.html');
renderShop();
loadMySession();

async function loadMySession() {
  try {
    const res  = await fetch('/api/duelist-auth/check', { credentials: 'include' });
    const data = await res.json();
    if (data.loggedIn) {
      myDuelistId = data.duelistId;
      renderShop();
    }
  } catch (err) { /* not logged in as a duelist, that's fine */ }
}

// ── Duelist: request to buy a shop item ─────────────────────
window.requestPurchase = async function(itemName) {
  const archs = getArchetypes();
  const a     = archs.find(x => x.name === itemName);
  const price = a ? a.price : 0;

  if (!confirm(`Request to buy ${itemName} for ${price.toLocaleString()} DP?\nThis needs admin approval before it takes effect.`)) return;

  const res  = await fetch('/api/requests/shop-purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ itemName }),
  });
  const data = await res.json();

  if (!data.success) {
    notify(`⚠️ ${data.message || 'Could not submit request'}`);
    return;
  }
  notify(`✅ Purchase request for ${itemName} sent to the admin for approval.`);
};

// ── Prefill ticket modal when selecting a known ticket type ─
const TICKET_DEFAULTS = {
  '☘️ Force Trade Ticket':      { price: '',                             desc: 'Force your opponent to trade archetypes with you. You choose the two archetypes to be traded.' },
  '☘️ Gambling Ticket':         { price: '3,000 DP or sacrifice 1 deck', desc: 'Receive rewards or consequences at random.' },
  '☘️ Lucky Discount Ticket':   { price: '3,000 DP or sacrifice 1 deck', desc: 'Receive a random discount ticket (10%, 25%, 50%, or 100%).' },
  '☘️ Magnet Ring Ticket':      { price: '',                             desc: 'Steal a random amount of DP from a random person who is in a different dorm from yours.' },
  '☘️ Deck Coffin Ticket':      { price: 'Sacrifice 1 deck',             desc: 'Sacrifice your deck and receive a new one based on the value of the deck you sacrificed.' },
  '☘️ Refund Ticket':           { price: 'Free',                         desc: 'Refund your deck and receive half of its value in return.' },
  '☘️ Respin Ticket':           { price: '3,000 DP or sacrifice 1 deck', desc: 'Spin the wheel again. The result of your previous spin may be replaced by the new result.' },
  '☘️ Dorm Switcher Ticket':    { price: '',                             desc: 'Target two people (including yourself, if desired) from different dorms and swap their dorms.' },
  '☘️ Semi Duplicator Ticket':  { price: '',                             desc: 'Target one archetype from the archetype list. That archetype can then be used by two people instead of one.' },
  '☘️ Forbidden Hammer Ticket': { price: '',                             desc: 'Target one archetype from the archetype list. That archetype becomes banned and cannot be used by anyone.' },
};

function prefillTicket(val) {
  const customGroup = document.getElementById('tk-custom-group');
  if (val === 'custom') {
    customGroup.style.display = '';
    document.getElementById('tk-price').value = '';
    document.getElementById('tk-desc').value  = '';
    return;
  }
  customGroup.style.display = 'none';
  const defaults = TICKET_DEFAULTS[val];
  if (defaults) {
    document.getElementById('tk-price').value = defaults.price;
    document.getElementById('tk-desc').value  = defaults.desc;
  } else {
    document.getElementById('tk-price').value = '';
    document.getElementById('tk-desc').value  = '';
  }
}

function openAddTicket() {
  document.getElementById('tk-name').value        = '';
  document.getElementById('tk-custom-name').value = '';
  document.getElementById('tk-price').value       = '';
  document.getElementById('tk-desc').value        = '';
  document.getElementById('tk-stock').value       = '1';
  document.getElementById('tk-custom-group').style.display = 'none';
  openModal('modal-add-ticket');
}

function submitAddTicket() {
  const sel    = document.getElementById('tk-name').value;
  const custom = document.getElementById('tk-custom-name').value.trim();
  const name   = sel === 'custom' ? custom : sel;
  const price  = document.getElementById('tk-price').value.trim();
  const desc   = document.getElementById('tk-desc').value.trim();
  const stock  = parseInt(document.getElementById('tk-stock').value) || 0;

  if (!name)  { notify('⚠️ Please select or enter a ticket name'); return; }

  const tickets = getTickets();
  tickets.push({ name, price, desc, stock });
  saveTickets(tickets);
  closeModal('modal-add-ticket');
  notify(`✅ "${name}" added`);
  renderTickets();
}