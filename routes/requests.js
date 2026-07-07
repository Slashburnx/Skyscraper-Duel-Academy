const express = require('express');
const crypto = require('crypto');
const requireModeratorOrAdmin = require('../middleware/moderatorAuth');
const requireDuelist = require('../middleware/duelistAuth');
const { getAtPath, setAtPath, loadTree } = require('../utils/tree');

const router = express.Router();

const KICK_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function findDuelistByUsername(duelistsObj, username) {
  const wanted = String(username || '').trim().toLowerCase();
  if (!wanted) return null;
  for (const [id, d] of Object.entries(duelistsObj || {})) {
    if (d && typeof d.username === 'string' && d.username.toLowerCase() === wanted) {
      return { id, duelist: d };
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════
// POST /api/requests/kick-member — a Dorm Leader (logged in as
// themselves) requests to kick a member of their own dorm.
// Nothing happens to the target until an admin approves it.
// ═══════════════════════════════════════════════════════════
router.post('/kick-member', requireDuelist, async (req, res) => {
  const { targetId, archToRemove } = req.body;
  const doc = await loadTree();
  const duelistsObj = getAtPath(doc.data, ['duelists']) || {};

  const leader = duelistsObj[req.duelistId];
  if (!leader) return res.status(404).json({ success: false, message: 'Your duelist record was not found.' });
  if (!(leader.titles || []).includes('Dorm Leader')) {
    return res.status(403).json({ success: false, message: 'Only a Dorm Leader can request this.' });
  }

  const sinceLastKick = Date.now() - (leader.lastKickAt || 0);
  if (sinceLastKick < KICK_COOLDOWN_MS) {
    const daysLeft = Math.ceil((KICK_COOLDOWN_MS - sinceLastKick) / (24 * 60 * 60 * 1000));
    return res.status(429).json({ success: false, message: `You already used this month's kick. ${daysLeft} day(s) left.` });
  }

  const target = duelistsObj[targetId];
  if (!target) return res.status(404).json({ success: false, message: 'Target duelist not found.' });
  if (target.dorm !== leader.dorm) return res.status(400).json({ success: false, message: 'That duelist is not in your dorm.' });
  if (targetId === req.duelistId) return res.status(400).json({ success: false, message: "You can't kick yourself." });

  const requestsObj = getAtPath(doc.data, ['requests']) || {};
  const alreadyPending = Object.values(requestsObj).some(
    r => r.type === 'kick_member' && r.status === 'pending' && r.requestedBy === req.duelistId
  );
  if (alreadyPending) {
    return res.status(409).json({ success: false, message: 'You already have a pending kick request awaiting admin approval.' });
  }

  const targetArchs = target.archs || [];
  let chosenArch = null;
  if (targetArchs.length === 1) {
    chosenArch = targetArchs[0];
  } else if (targetArchs.length > 1) {
    if (!archToRemove || !targetArchs.includes(archToRemove)) {
      return res.status(400).json({ success: false, message: 'Choose which of their archetypes should be removed.', needsArchChoice: true, options: targetArchs });
    }
    chosenArch = archToRemove;
  }

  const id = crypto.randomBytes(8).toString('hex');
  const request = {
    id,
    type: 'kick_member',
    status: 'pending',
    requestedBy: req.duelistId,
    requestedByName: leader.name,
    targetId,
    targetName: target.name,
    archToRemove: chosenArch,
    createdAt: Date.now(),
    resolvedAt: null,
    rejectionReason: null,
  };

  doc.data = setAtPath(doc.data, ['requests', id], request);
  doc.markModified('data');
  await doc.save();

  res.json({ success: true, request });
});

// ═══════════════════════════════════════════════════════════
// POST /api/requests/shop-purchase — a duelist requests to buy
// an archetype currently listed in the shop. Nothing happens
// to their DP/archetypes until an admin approves it.
// ═══════════════════════════════════════════════════════════
router.post('/shop-purchase', requireDuelist, async (req, res) => {
  const { itemName } = req.body;
  if (!itemName) return res.status(400).json({ success: false, message: 'No item specified.' });

  const doc = await loadTree();
  const duelistsObj   = getAtPath(doc.data, ['duelists']) || {};
  const archetypesObj = getAtPath(doc.data, ['archetypes']) || {};
  const shopBudget     = getAtPath(doc.data, ['shop', 'budget'])  || [];
  const shopPremium    = getAtPath(doc.data, ['shop', 'premium']) || [];

  const buyer = duelistsObj[req.duelistId];
  if (!buyer) return res.status(404).json({ success: false, message: 'Your duelist record was not found.' });

  const stillInShop = shopBudget.includes(itemName) || shopPremium.includes(itemName);
  if (!stillInShop) {
    return res.status(404).json({ success: false, message: 'That item is no longer available in the shop.' });
  }

  const archetype = Object.values(archetypesObj).find(a => a.name === itemName);
  if (!archetype) return res.status(404).json({ success: false, message: 'Archetype not found.' });
  if (archetype.status === 'Forbidden')   return res.status(400).json({ success: false, message: 'That archetype is Forbidden.' });
  if (archetype.status === 'Unavailable') return res.status(400).json({ success: false, message: 'That archetype is Unavailable.' });

  const owners = Object.values(duelistsObj).filter(d => (d.archs || []).includes(itemName));
  const ownerLimit = archetype.status === 'Triplicated' ? 3 : archetype.status === 'Semi-Duplicated' ? 2 : 1;
  if (owners.length >= ownerLimit) {
    return res.status(409).json({ success: false, message: `Already owned by ${owners.map(d => d.name).join(', ')}.` });
  }

  if ((buyer.archs || []).length >= 4) {
    return res.status(400).json({ success: false, message: 'You already have 4 archetypes (the maximum).' });
  }
  if ((buyer.dp || 0) < archetype.price) {
    return res.status(400).json({ success: false, message: `You need ${archetype.price.toLocaleString()} DP but only have ${(buyer.dp||0).toLocaleString()}.` });
  }

  const requestsObj = getAtPath(doc.data, ['requests']) || {};
  const alreadyPending = Object.values(requestsObj).some(
    r => r.type === 'shop_purchase' && r.status === 'pending' && r.requestedBy === req.duelistId && r.itemName === itemName
  );
  if (alreadyPending) {
    return res.status(409).json({ success: false, message: 'You already requested this item — waiting on admin approval.' });
  }

  const id = crypto.randomBytes(8).toString('hex');
  const request = {
    id,
    type: 'shop_purchase',
    status: 'pending',
    requestedBy: req.duelistId,
    requestedByName: buyer.name,
    itemName,
    price: archetype.price,
    createdAt: Date.now(),
    resolvedAt: null,
    rejectionReason: null,
  };

  doc.data = setAtPath(doc.data, ['requests', id], request);
  doc.markModified('data');
  await doc.save();

  res.json({ success: true, request });
});

// Maps the exact ticket names (as stored in a duelist's inventory) to an
// internal type key. Only these 8 have full automation right now — the
// rest (Gambling, Magnet Ring, Deck Coffin, Lucky Discount, Respin, Star
// Multiplier, Gambling V2) are still admin-manual until built later.
const AUTOMATED_TICKETS = {
  '☘️ Force Trade Ticket':       'force_trade',
  '☘️ Refund Ticket':            'refund',
  '☘️ Forbidden Hammer Ticket':  'forbidden_hammer',
  '☘️ Status Removal Ticket':    'status_removal',
  '☘️ Semi Duplicator Ticket':   'semi_duplicator',
  '☘️ Triplet Generator Ticket': 'triplet_generator',
  '☘️ Dorm Switcher Ticket':     'dorm_switcher',
  '☘️ Bracket Switcher Ticket':  'bracket_switcher',
};

// ═══════════════════════════════════════════════════════════
// POST /api/requests/use-ticket — a duelist requests to use a
// ticket they own. The ticket is only actually consumed (and
// its effect applied) once an admin approves.
// ═══════════════════════════════════════════════════════════
router.post('/use-ticket', requireDuelist, async (req, res) => {
  const { ticketName, params } = req.body;
  const ticketType = AUTOMATED_TICKETS[ticketName];

  if (!ticketType) {
    return res.status(400).json({ success: false, message: 'That ticket type is not yet supported for automatic use.' });
  }

  const doc = await loadTree();
  const duelistsObj = getAtPath(doc.data, ['duelists']) || {};
  const requester = duelistsObj[req.duelistId];
  if (!requester) return res.status(404).json({ success: false, message: 'Your duelist record was not found.' });

  const owned = (requester.tickets || []).filter(t => t === ticketName).length;
  const requestsObj = getAtPath(doc.data, ['requests']) || {};
  const pendingCount = Object.values(requestsObj).filter(
    r => r.type === 'use_ticket' && r.status === 'pending' && r.requestedBy === req.duelistId && r.ticketName === ticketName
  ).length;

  if (owned <= pendingCount) {
    return res.status(409).json({ success: false, message: `You don't have a free ${ticketName} available (or one is already pending approval).` });
  }

  // ── Per-ticket validation ──────────────────────────────────
  const p = params || {};
  const archetypesObj = getAtPath(doc.data, ['archetypes']) || {};

  if (ticketType === 'force_trade') {
    const target = duelistsObj[p.targetId];
    if (!target) return res.status(404).json({ success: false, message: 'Target duelist not found.' });
    if (target.id === req.duelistId) return res.status(400).json({ success: false, message: "You can't trade with yourself." });
    if ((target.titles || []).includes('Skyscraper Champion')) {
      return res.status(403).json({ success: false, message: `${target.name} is a Skyscraper Champion — immune to Force Trade.` });
    }
    if (!(requester.archs || []).includes(p.myArchetype)) {
      return res.status(400).json({ success: false, message: 'You do not own that archetype.' });
    }
    if (!(target.archs || []).includes(p.theirArchetype)) {
      return res.status(400).json({ success: false, message: `${target.name} does not own that archetype.` });
    }
  } else if (ticketType === 'refund') {
    if (!(requester.archs || []).includes(p.archetypeName)) {
      return res.status(400).json({ success: false, message: 'You do not own that archetype.' });
    }
  } else if (ticketType === 'forbidden_hammer' || ticketType === 'semi_duplicator' || ticketType === 'triplet_generator') {
    const a = Object.values(archetypesObj).find(x => x.name === p.archetypeName);
    if (!a) return res.status(404).json({ success: false, message: 'Archetype not found.' });
  } else if (ticketType === 'status_removal') {
    const a = Object.values(archetypesObj).find(x => x.name === p.archetypeName);
    if (!a) return res.status(404).json({ success: false, message: 'Archetype not found.' });
    if (!['Forbidden', 'Semi-Duplicated', 'Triplicated'].includes(a.status)) {
      return res.status(400).json({ success: false, message: 'That archetype has no status to remove.' });
    }
  } else if (ticketType === 'dorm_switcher') {
    const a = duelistsObj[p.duelistAId];
    const b = duelistsObj[p.duelistBId];
    if (!a || !b) return res.status(404).json({ success: false, message: 'One or both duelists not found.' });
    if (a.id === b.id) return res.status(400).json({ success: false, message: 'Choose two different duelists.' });
  } else if (ticketType === 'bracket_switcher') {
    const players = getAtPath(doc.data, ['bracket', 'players']) || [];
    if (!players.includes(p.nameA) || !players.includes(p.nameB)) {
      return res.status(400).json({ success: false, message: 'Both names must currently be in the bracket.' });
    }
    if (p.nameA === p.nameB) return res.status(400).json({ success: false, message: 'Choose two different bracket entries.' });
  }

  const id = crypto.randomBytes(8).toString('hex');
  const request = {
    id,
    type: 'use_ticket',
    ticketType,
    status: 'pending',
    requestedBy: req.duelistId,
    requestedByName: requester.name,
    ticketName,
    params: p,
    createdAt: Date.now(),
    resolvedAt: null,
    rejectionReason: null,
  };

  doc.data = setAtPath(doc.data, ['requests', id], request);
  doc.markModified('data');
  await doc.save();

  res.json({ success: true, request });
});

// GET /api/requests — full queue, admin only.
router.get('/', requireModeratorOrAdmin, async (req, res) => {
  const doc = await loadTree();
  const requestsObj = getAtPath(doc.data, ['requests']) || {};
  const all = Object.values(requestsObj).sort((a, b) => b.createdAt - a.createdAt);
  res.json({ requests: all });
});

// GET /api/requests/mine — a duelist's own requests (ones they made, or ones made about them).
router.get('/mine', requireDuelist, async (req, res) => {
  const doc = await loadTree();
  const requestsObj = getAtPath(doc.data, ['requests']) || {};
  const mine = Object.values(requestsObj)
    .filter(r => r.requestedBy === req.duelistId || r.targetId === req.duelistId)
    .sort((a, b) => b.createdAt - a.createdAt);
  res.json({ requests: mine });
});

// POST /api/requests/:id/approve — admin approves; the actual effect happens here, server-side.
router.post('/:id/approve', requireModeratorOrAdmin, async (req, res) => {
  const { id } = req.params;
  const doc = await loadTree();
  const request = getAtPath(doc.data, ['requests', id]);

  if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });
  if (request.status !== 'pending') return res.status(409).json({ success: false, message: 'This request was already resolved.' });

  if (request.type === 'claim_account') {
    const duelistsObj = getAtPath(doc.data, ['duelists']) || {};
    const duelist = duelistsObj[request.duelistId];
    if (!duelist) return res.status(404).json({ success: false, message: 'Duelist no longer exists.' });
    if (duelist.accountActive) {
      return res.status(409).json({ success: false, message: `${duelist.name} already has an account. Reject instead.` });
    }
    if (findDuelistByUsername(duelistsObj, request.username)) {
      return res.status(409).json({ success: false, message: 'That username was taken in the meantime. Reject instead.' });
    }

    doc.data = setAtPath(doc.data, ['duelists', duelist.id], {
      ...duelist,
      username: request.username,
      passwordHash: request.passwordHash,
      accountActive: true,
    });
  }

  if (request.type === 'kick_member') {
    const duelistsObj = getAtPath(doc.data, ['duelists']) || {};
    const leader = duelistsObj[request.requestedBy];
    const target = duelistsObj[request.targetId];

    if (!leader || !target) {
      return res.status(404).json({ success: false, message: 'Leader or target no longer exists.' });
    }

    const remainingArchs = (target.archs || []).filter(a => a !== request.archToRemove);
    const otherDorms = ['obelisk', 'ra', 'slifer'].filter(dm => dm !== target.dorm);
    const newDorm = otherDorms[Math.floor(Math.random() * otherDorms.length)];
    const newDp = Math.max(0, (target.dp || 0) - 10000);

    doc.data = setAtPath(doc.data, ['duelists', target.id], {
      ...target, dp: newDp, archs: remainingArchs, dorm: newDorm,
    });
    doc.data = setAtPath(doc.data, ['duelists', leader.id], {
      ...leader, lastKickAt: Date.now(),
    });
  }

  if (request.type === 'shop_purchase') {
    const duelistsObj   = getAtPath(doc.data, ['duelists']) || {};
    const archetypesObj = getAtPath(doc.data, ['archetypes']) || {};
    const buyer = duelistsObj[request.requestedBy];

    if (!buyer) return res.status(404).json({ success: false, message: 'Buyer no longer exists.' });

    // Re-validate now, since things may have changed since the request was submitted
    // (someone else bought it, buyer spent their DP elsewhere, etc.)
    const archetype = Object.values(archetypesObj).find(a => a.name === request.itemName);
    if (!archetype) return res.status(404).json({ success: false, message: 'Archetype no longer exists.' });

    const owners = Object.values(duelistsObj).filter(d => (d.archs || []).includes(request.itemName));
    const ownerLimit = archetype.status === 'Triplicated' ? 3 : archetype.status === 'Semi-Duplicated' ? 2 : 1;
    if (owners.length >= ownerLimit) {
      return res.status(409).json({ success: false, message: `Can't approve — already owned by ${owners.map(d => d.name).join(', ')}. Reject instead.` });
    }
    if ((buyer.archs || []).length >= 4) {
      return res.status(400).json({ success: false, message: `Can't approve — ${buyer.name} already has 4 archetypes. Reject instead.` });
    }
    if ((buyer.dp || 0) < request.price) {
      return res.status(400).json({ success: false, message: `Can't approve — ${buyer.name} no longer has enough DP. Reject instead.` });
    }

    doc.data = setAtPath(doc.data, ['duelists', buyer.id], {
      ...buyer,
      dp: (buyer.dp || 0) - request.price,
      archs: [...(buyer.archs || []), request.itemName],
    });
  }

  if (request.type === 'use_ticket') {
    const duelistsObj   = getAtPath(doc.data, ['duelists']) || {};
    const archetypesObj = getAtPath(doc.data, ['archetypes']) || {};
    const requester = duelistsObj[request.requestedBy];
    if (!requester) return res.status(404).json({ success: false, message: 'Requester no longer exists.' });

    const owned = (requester.tickets || []).filter(t => t === request.ticketName).length;
    if (owned < 1) {
      return res.status(409).json({ success: false, message: `${requester.name} no longer has that ticket. Reject instead.` });
    }

    const p = request.params || {};
    const findArch = name => Object.values(archetypesObj).find(a => a.name === name);

    // Consume one copy of the ticket regardless of effect below.
    const remainingTickets = [...(requester.tickets || [])];
    remainingTickets.splice(remainingTickets.indexOf(request.ticketName), 1);
    doc.data = setAtPath(doc.data, ['duelists', requester.id], { ...requester, tickets: remainingTickets });

    if (request.ticketType === 'force_trade') {
      const target = duelistsObj[p.targetId];
      if (!target) return res.status(404).json({ success: false, message: 'Target no longer exists. Reject instead.' });
      if (!(requester.archs || []).includes(p.myArchetype) || !(target.archs || []).includes(p.theirArchetype)) {
        return res.status(409).json({ success: false, message: 'Archetypes changed since this was requested. Reject instead.' });
      }
      const newRequesterArchs = requester.archs.filter(a => a !== p.myArchetype).concat(p.theirArchetype);
      const newTargetArchs    = target.archs.filter(a => a !== p.theirArchetype).concat(p.myArchetype);
      doc.data = setAtPath(doc.data, ['duelists', requester.id], { ...requester, tickets: remainingTickets, archs: newRequesterArchs });
      doc.data = setAtPath(doc.data, ['duelists', target.id],    { ...target, archs: newTargetArchs });
    }

    else if (request.ticketType === 'refund') {
      const a = findArch(p.archetypeName);
      if (!(requester.archs || []).includes(p.archetypeName)) {
        return res.status(409).json({ success: false, message: 'No longer owns that archetype. Reject instead.' });
      }
      const refundAmount = a ? Math.round(a.price * 0.5) : 0;
      doc.data = setAtPath(doc.data, ['duelists', requester.id], {
        ...requester, tickets: remainingTickets,
        archs: requester.archs.filter(x => x !== p.archetypeName),
        dp: (requester.dp || 0) + refundAmount,
      });
    }

    else if (request.ticketType === 'forbidden_hammer') {
      const a = findArch(p.archetypeName);
      if (!a) return res.status(404).json({ success: false, message: 'Archetype no longer exists. Reject instead.' });
      doc.data = setAtPath(doc.data, ['archetypes', a.id], { ...a, status: 'Forbidden' });
    }

    else if (request.ticketType === 'semi_duplicator') {
      const a = findArch(p.archetypeName);
      if (!a) return res.status(404).json({ success: false, message: 'Archetype no longer exists. Reject instead.' });
      doc.data = setAtPath(doc.data, ['archetypes', a.id], { ...a, status: 'Semi-Duplicated' });
    }

    else if (request.ticketType === 'triplet_generator') {
      const a = findArch(p.archetypeName);
      if (!a) return res.status(404).json({ success: false, message: 'Archetype no longer exists. Reject instead.' });
      doc.data = setAtPath(doc.data, ['archetypes', a.id], { ...a, status: 'Triplicated' });
    }

    else if (request.ticketType === 'status_removal') {
      const a = findArch(p.archetypeName);
      if (!a) return res.status(404).json({ success: false, message: 'Archetype no longer exists. Reject instead.' });
      doc.data = setAtPath(doc.data, ['archetypes', a.id], { ...a, status: '' });
    }

    else if (request.ticketType === 'dorm_switcher') {
      const a = duelistsObj[p.duelistAId];
      const b = duelistsObj[p.duelistBId];
      if (!a || !b) return res.status(404).json({ success: false, message: 'One or both duelists no longer exist. Reject instead.' });
      doc.data = setAtPath(doc.data, ['duelists', a.id], { ...a, dorm: b.dorm });
      doc.data = setAtPath(doc.data, ['duelists', b.id], { ...b, dorm: a.dorm });
    }

    else if (request.ticketType === 'bracket_switcher') {
      const players = getAtPath(doc.data, ['bracket', 'players']) || [];
      const idxA = players.indexOf(p.nameA);
      const idxB = players.indexOf(p.nameB);
      if (idxA === -1 || idxB === -1) {
        return res.status(409).json({ success: false, message: 'One or both names are no longer in the bracket. Reject instead.' });
      }
      const swapped = [...players];
      [swapped[idxA], swapped[idxB]] = [swapped[idxB], swapped[idxA]];
      doc.data = setAtPath(doc.data, ['bracket', 'players'], swapped);
    }
  }

  doc.data = setAtPath(doc.data, ['requests', id], {
    ...request, status: 'approved', resolvedAt: Date.now(),
  });
  doc.markModified('data');
  await doc.save();

  res.json({ success: true });
});

// POST /api/requests/:id/reject — admin rejects; nothing happens to the data.
router.post('/:id/reject', requireModeratorOrAdmin, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const doc = await loadTree();
  const request = getAtPath(doc.data, ['requests', id]);

  if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });
  if (request.status !== 'pending') return res.status(409).json({ success: false, message: 'This request was already resolved.' });

  doc.data = setAtPath(doc.data, ['requests', id], {
    ...request, status: 'rejected', resolvedAt: Date.now(), rejectionReason: reason || null,
  });
  doc.markModified('data');
  await doc.save();

  res.json({ success: true });
});

module.exports = router;