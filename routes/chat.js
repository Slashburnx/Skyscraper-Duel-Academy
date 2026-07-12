const express = require('express');
const crypto = require('crypto');
const requireDuelist = require('../middleware/duelistAuth');
const requireAnyLogin = require('../middleware/anyAuth');
const { getAtPath, setAtPath, loadTree } = require('../utils/tree');

const router = express.Router();

const MAX_MESSAGES = 300; // per conversation, oldest trimmed off

function makeMessage({ senderType, senderId, senderName, text, imageUrl }) {
  return {
    id: crypto.randomBytes(6).toString('hex'),
    senderType, senderId, senderName,
    text: String(text || '').slice(0, 1000), // sane cap so nobody pastes a novel
    imageUrl: imageUrl || null,
    createdAt: Date.now(),
  };
}

function dmKey(idA, idB) {
  return [idA, idB].sort().join('__');
}

async function resolveActorName(doc, actor) {
  if (actor.type === 'admin') return 'Admin';
  const duelist = getAtPath(doc.data, ['duelists', actor.id]);
  return duelist ? duelist.name : 'Unknown';
}

// ═══════════════════════════════════════════════════════════
// SHARED ACADEMY ROOM — everyone logged in (admin or duelist) sees the same feed
// ═══════════════════════════════════════════════════════════
router.get('/room', requireAnyLogin, async (req, res) => {
  const doc = await loadTree();
  const messages = getAtPath(doc.data, ['chat', 'room']) || [];
  res.json({ messages });
});

router.post('/room', requireAnyLogin, async (req, res) => {
  const { text, imageUrl } = req.body;
  if ((!text || !text.trim()) && !imageUrl) {
    return res.status(400).json({ success: false, message: 'Message cannot be empty.' });
  }
  if (imageUrl && !imageUrl.startsWith('https://')) {
    return res.status(400).json({ success: false, message: 'Invalid image URL.' });
  }

  const doc = await loadTree();
  const senderName = await resolveActorName(doc, req.actor);
  const messages = getAtPath(doc.data, ['chat', 'room']) || [];

  const msg = makeMessage({ senderType: req.actor.type, senderId: req.actor.id, senderName, text, imageUrl });
  const updated = [...messages, msg].slice(-MAX_MESSAGES);

  doc.data = setAtPath(doc.data, ['chat', 'room'], updated);
  doc.markModified('data');
  await doc.save();

  res.json({ success: true, message: msg });
});

// ═══════════════════════════════════════════════════════════
// DIRECT MESSAGES — duelist to duelist, lives on each other's profile page
// ═══════════════════════════════════════════════════════════
router.get('/dm/:otherId', requireDuelist, async (req, res) => {
  const key = dmKey(req.duelistId, req.params.otherId);
  const doc = await loadTree();
  const messages = getAtPath(doc.data, ['chat', 'dm', key]) || [];
  res.json({ messages });
});

router.post('/dm/:otherId', requireDuelist, async (req, res) => {
  const { text, imageUrl } = req.body;
  const { otherId } = req.params;
  if ((!text || !text.trim()) && !imageUrl) {
    return res.status(400).json({ success: false, message: 'Message cannot be empty.' });
  }
  if (imageUrl && !imageUrl.startsWith('https://')) {
    return res.status(400).json({ success: false, message: 'Invalid image URL.' });
  }

  const doc = await loadTree();
  const duelistsObj = getAtPath(doc.data, ['duelists']) || {};
  const sender = duelistsObj[req.duelistId];
  const other  = duelistsObj[otherId];
  if (!other) return res.status(404).json({ success: false, message: 'That duelist was not found.' });

  const key = dmKey(req.duelistId, otherId);
  const messages = getAtPath(doc.data, ['chat', 'dm', key]) || [];
  const msg = makeMessage({ senderType: 'duelist', senderId: req.duelistId, senderName: sender?.name || 'Unknown', text, imageUrl });
  const updated = [...messages, msg].slice(-MAX_MESSAGES);

  doc.data = setAtPath(doc.data, ['chat', 'dm', key], updated);
  doc.markModified('data');
  await doc.save();

  res.json({ success: true, message: msg });
});

module.exports = router;