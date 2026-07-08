// ═══════════════════════════════════════════════════════════
// YGO SKYSCRAPER — REQUESTS.JS
// The approval queue: Dorm Leader kick requests today, more
// request types (shop, trades, tickets) will plug in later.
// ═══════════════════════════════════════════════════════════

injectNav('requests.html');

const STATUS_COLOR = { pending: '#E0B400', approved: '#4CAF7D', rejected: '#FF6B6B' };
const STATUS_LABEL = { pending: '⏳ Pending', approved: '✅ Approved', rejected: '❌ Rejected' };

const TYPE_LABEL = { kick_member: '👢 Kick Member', shop_purchase: '🛒 Shop Purchase', use_ticket: '🎟️ Use Ticket', claim_account: '🎓 Account Claim', password_reset: '🔑 Password Reset' };

function ticketDetail(r) {
  const p = r.params || {};
  switch (r.ticketType) {
    case 'force_trade':       return `wants to trade their <strong>${p.myArchetype}</strong> for <strong>${p.theirArchetype}</strong>`;
    case 'refund':             return `wants to refund <strong>${p.archetypeName}</strong> (50% DP back)`;
    case 'forbidden_hammer':   return `wants to make <strong>${p.archetypeName}</strong> Forbidden`;
    case 'semi_duplicator':    return `wants to Semi-Duplicate <strong>${p.archetypeName}</strong> (2 owners allowed)`;
    case 'triplet_generator':  return `wants to Triplicate <strong>${p.archetypeName}</strong> (3 owners allowed)`;
    case 'status_removal':     return `wants to clear the status on <strong>${p.archetypeName}</strong>`;
    case 'dorm_switcher':      return `wants two duelists to swap dorms`;
    case 'bracket_switcher':   return `wants <strong>${p.nameA}</strong> and <strong>${p.nameB}</strong> to swap bracket positions`;
    default: return '';
  }
}

function requestCard(r, { showActions } = {}) {
  const when = new Date(r.createdAt).toLocaleString();
  let detail = '';
  if (r.type === 'kick_member') {
    detail = `<strong>${r.requestedByName}</strong> (Dorm Leader) wants to kick <strong>${r.targetName}</strong>` +
              (r.archToRemove ? ` — would lose the archetype <em>${r.archToRemove}</em>` : '') +
              ` and 10,000 DP.`;
  } else if (r.type === 'shop_purchase') {
    detail = `<strong>${r.requestedByName}</strong> wants to buy <strong>${r.itemName}</strong> for ${r.price.toLocaleString()} DP.`;
  } else if (r.type === 'use_ticket') {
    detail = `<strong>${r.requestedByName}</strong> used a <em>${r.ticketName}</em> — ${ticketDetail(r)}.`;
  } else if (r.type === 'claim_account') {
    detail = `Someone wants to claim <strong>${r.duelistName}</strong> with the username <strong>${r.username}</strong>.`;
  } else if (r.type === 'password_reset') {
    detail = `<strong>${r.duelistName}</strong> (username: ${r.username}) forgot their password.`;
  }

  return `
    <div class="card" style="padding:14px 16px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">
        <div>
          <div style="font-size:0.72rem;color:var(--muted);margin-bottom:4px;">${TYPE_LABEL[r.type] || r.type} · ${when}</div>
          <div style="font-size:0.88rem;color:#E8E8F0;">${detail}</div>
          ${r.status === 'rejected' && r.rejectionReason ? `<div style="font-size:0.78rem;color:var(--muted);margin-top:5px;">Reason: ${r.rejectionReason}</div>` : ''}
        </div>
        <span style="font-size:0.75rem;font-weight:700;color:${STATUS_COLOR[r.status]};white-space:nowrap;">${STATUS_LABEL[r.status]}</span>
      </div>
      ${showActions && r.status === 'pending' ? `
        <div style="margin-top:10px;display:flex;gap:8px;">
          <button class="btn-gold" style="padding:5px 14px;font-size:0.8rem;" onclick="approveRequest('${r.id}')">Approve</button>
          <button class="btn-icon" style="padding:5px 14px;font-size:0.8rem;color:#FF6B6B;" onclick="rejectRequest('${r.id}')">Reject</button>
        </div>
      ` : ''}
    </div>`;
}

async function loadAdminQueue() {
  const res  = await fetch('/api/requests', { credentials: 'include' });
  if (!res.ok) return;
  const data = await res.json();

  const pending = data.requests.filter(r => r.status === 'pending');
  const history = data.requests.filter(r => r.status !== 'pending');

  document.getElementById('req-admin-pending').innerHTML =
    pending.length ? pending.map(r => requestCard(r, { showActions: true })).join('')
                   : `<p style="color:var(--muted);font-size:0.85rem;">No pending requests.</p>`;

  document.getElementById('req-admin-history').innerHTML =
    history.length ? history.map(r => requestCard(r, { showActions: false })).join('')
                   : `<p style="color:var(--muted);font-size:0.85rem;">Nothing resolved yet.</p>`;

  document.getElementById('req-admin-section').style.display = 'block';
}

async function loadMyRequests() {
  const res  = await fetch('/api/requests/mine', { credentials: 'include' });
  if (!res.ok) return;
  const data = await res.json();

  document.getElementById('req-mine-list').innerHTML =
    data.requests.length ? data.requests.map(r => requestCard(r, { showActions: false })).join('')
                         : `<p style="color:var(--muted);font-size:0.85rem;">You have no requests yet.</p>`;

  document.getElementById('req-mine-section').style.display = 'block';
}

window.approveRequest = async function(id) {
  if (!confirm('Approve this request? The effect will be applied immediately.')) return;
  const res  = await fetch(`/api/requests/${id}/approve`, { method: 'POST', credentials: 'include' });
  const data = await res.json();
  if (!data.success) { notify(`⚠️ ${data.message || 'Could not approve'}`); return; }

  if (data.resetToken) {
    const link = `${window.location.origin}/reset-password.html?token=${data.resetToken}`;
    try {
      await navigator.clipboard.writeText(link);
      notify('✅ Approved! Reset link copied to clipboard — send it to them.');
    } catch {
      prompt('Approved! Copy this reset link and send it to them (valid 7 days):', link);
    }
  } else {
    notify('✅ Request approved');
  }
  loadAdminQueue();
};

window.rejectRequest = async function(id) {
  const reason = prompt('Optional: reason for rejecting (shown to the duelist)') || '';
  const res  = await fetch(`/api/requests/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ reason }),
  });
  const data = await res.json();
  if (!data.success) { notify(`⚠️ ${data.message || 'Could not reject'}`); return; }
  notify('Request rejected');
  loadAdminQueue();
};

(async function init() {
  const [adminRes, duelistRes] = await Promise.all([
    fetch('/api/admin/check',        { credentials: 'include' }).then(r => r.json()),
    fetch('/api/duelist-auth/check', { credentials: 'include' }).then(r => r.json()),
  ]);

  let shownAny = false;
  const isModerator = !adminRes.isAdmin && duelistRes.loggedIn && duelistRes.isModerator;
  if (adminRes.isAdmin || isModerator) { await loadAdminQueue(); shownAny = true; }
  if (duelistRes.loggedIn && !isModerator) { await loadMyRequests(); shownAny = true; }
  if (isModerator) { await loadMyRequests(); } // moderators can still see their own submitted requests too
  if (!shownAny) document.getElementById('req-signed-out').style.display = 'block';
})();