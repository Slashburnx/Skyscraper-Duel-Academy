const express = require('express');
const crypto = require('crypto');
const requireAdmin = require('../middleware/auth');
const requireDuelist = require('../middleware/duelistAuth');
const { getAtPath, setAtPath, loadTree } = require('../utils/tree');

const router = express.Router();

const KICK_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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
  if (owners.length > 0) {
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

// GET /api/requests — full queue, admin only.
router.get('/', requireAdmin, async (req, res) => {
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
router.post('/:id/approve', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const doc = await loadTree();
  const request = getAtPath(doc.data, ['requests', id]);

  if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });
  if (request.status !== 'pending') return res.status(409).json({ success: false, message: 'This request was already resolved.' });

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
    if (owners.length > 0) {
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

  doc.data = setAtPath(doc.data, ['requests', id], {
    ...request, status: 'approved', resolvedAt: Date.now(),
  });
  doc.markModified('data');
  await doc.save();

  res.json({ success: true });
});

// POST /api/requests/:id/reject — admin rejects; nothing happens to the data.
router.post('/:id/reject', requireAdmin, async (req, res) => {
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