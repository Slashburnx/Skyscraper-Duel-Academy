const express = require('express');
const crypto = require('crypto');
const requireModeratorOrAdmin = require('../middleware/moderatorAuth');
const requireDuelist = require('../middleware/duelistAuth');
const requireAnyLogin = require('../middleware/anyAuth');
const { getAtPath, setAtPath, loadTree } = require('../utils/tree');

const router = express.Router();

const MAX_MESSAGES = 300; // per conversation, oldest trimmed off

function makeMessage({ senderType, senderId, senderName, text }) {
  return {
    id: crypto.randomBytes(6).toString('hex'),
    senderType, senderId, senderName,
    text: String(text).slice(0, 1000), // sane cap so nobody pastes a novel
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
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ success: false, message: 'Message cannot be empty.' });

  const doc = await loadTree();
  const senderName = await resolveActorName(doc, req.actor);
  const messages = getAtPath(doc.data, ['chat', 'room']) || [];

  const msg = makeMessage({ senderType: req.actor.type, senderId: req.actor.id, senderName, text });
  const updated = [...messages, msg].slice(-MAX_MESSAGES);

  doc.data = setAtPath(doc.data, ['chat', 'room'], updated);
  doc.markModified('data');
  await doc.save();

  res.json({ success: true, message: msg });
});

// ═══════════════════════════════════════════════════════════
// ADMIN INBOX — one private thread per duelist, with the admin
// ═══════════════════════════════════════════════════════════

// GET /api/chat/inbox/mine — a duelist's own thread with the admin
router.get('/inbox/mine', requireDuelist, async (req, res) => {
  const doc = await loadTree();
  const messages = getAtPath(doc.data, ['chat', 'inbox', req.duelistId]) || [];
  res.json({ messages });
});

// POST /api/chat/inbox/mine — duelist sends a message to the admin
router.post('/inbox/mine', requireDuelist, async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ success: false, message: 'Message cannot be empty.' });

  const doc = await loadTree();
  const duelist = getAtPath(doc.data, ['duelists', req.duelistId]);
  const messages = getAtPath(doc.data, ['chat', 'inbox', req.duelistId]) || [];

  const msg = makeMessage({ senderType: 'duelist', senderId: req.duelistId, senderName: duelist?.name || 'Unknown', text });
  const updated = [...messages, msg].slice(-MAX_MESSAGES);

  doc.data = setAtPath(doc.data, ['chat', 'inbox', req.duelistId], updated);
  doc.markModified('data');
  await doc.save();

  res.json({ success: true, message: msg });
});

// GET /api/chat/inbox-list — admin only: every duelist + their inbox's last message (to build a conversation list)
router.get('/inbox-list', requireModeratorOrAdmin, async (req, res) => {
  const doc = await loadTree();
  const duelistsObj = getAtPath(doc.data, ['duelists']) || {};
  const inboxObj = getAtPath(doc.data, ['chat', 'inbox']) || {};

  const list = Object.values(duelistsObj)
    .filter(d => d.accountActive) // only duelists who can actually chat
    .map(d => {
      const thread = inboxObj[d.id] || [];
      const last = thread[thread.length - 1];
      return {
        duelistId: d.id,
        name: d.name,
        lastMessage: last ? last.text : null,
        lastAt: last ? last.createdAt : null,
        unread: thread.some(m => m.senderType === 'duelist' && !m.readByAdmin),
      };
    })
    .sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));

  res.json({ conversations: list });
});

// GET /api/chat/inbox/:duelistId — admin views a specific duelist's thread (and marks it read)
router.get('/inbox/:duelistId', requireModeratorOrAdmin, async (req, res) => {
  const { duelistId } = req.params;
  const doc = await loadTree();
  const messages = getAtPath(doc.data, ['chat', 'inbox', duelistId]) || [];

  const markedRead = messages.map(m => m.senderType === 'duelist' ? { ...m, readByAdmin: true } : m);
  doc.data = setAtPath(doc.data, ['chat', 'inbox', duelistId], markedRead);
  doc.markModified('data');
  await doc.save();

  res.json({ messages: markedRead });
});

// POST /api/chat/inbox/:duelistId — admin sends a message to a specific duelist
router.post('/inbox/:duelistId', requireModeratorOrAdmin, async (req, res) => {
  const { duelistId } = req.params;
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ success: false, message: 'Message cannot be empty.' });

  const doc = await loadTree();
  const duelist = getAtPath(doc.data, ['duelists', duelistId]);
  if (!duelist) return res.status(404).json({ success: false, message: 'Duelist not found.' });

  const messages = getAtPath(doc.data, ['chat', 'inbox', duelistId]) || [];
  const msg = makeMessage({ senderType: 'admin', senderId: 'admin', senderName: 'Admin', text });
  const updated = [...messages, msg].slice(-MAX_MESSAGES);

  doc.data = setAtPath(doc.data, ['chat', 'inbox', duelistId], updated);
  doc.markModified('data');
  await doc.save();

  res.json({ success: true, message: msg });
});

// ═══════════════════════════════════════════════════════════
// DIRECT MESSAGES — duelist to duelist
// ═══════════════════════════════════════════════════════════

// GET /api/chat/dm-contacts — every other active duelist, for starting a DM
router.get('/dm-contacts', requireDuelist, async (req, res) => {
  const doc = await loadTree();
  const duelistsObj = getAtPath(doc.data, ['duelists']) || {};
  const contacts = Object.values(duelistsObj)
    .filter(d => d.accountActive && d.id !== req.duelistId)
    .map(d => ({ duelistId: d.id, name: d.name }));
  res.json({ contacts });
});

router.get('/dm/:otherId', requireDuelist, async (req, res) => {
  const key = dmKey(req.duelistId, req.params.otherId);
  const doc = await loadTree();
  const messages = getAtPath(doc.data, ['chat', 'dm', key]) || [];
  res.json({ messages });
});

router.post('/dm/:otherId', requireDuelist, async (req, res) => {
  const { text } = req.body;
  const { otherId } = req.params;
  if (!text || !text.trim()) return res.status(400).json({ success: false, message: 'Message cannot be empty.' });

  const doc = await loadTree();
  const duelistsObj = getAtPath(doc.data, ['duelists']) || {};
  const sender = duelistsObj[req.duelistId];
  const other  = duelistsObj[otherId];
  if (!other) return res.status(404).json({ success: false, message: 'That duelist was not found.' });

  const key = dmKey(req.duelistId, otherId);
  const messages = getAtPath(doc.data, ['chat', 'dm', key]) || [];
  const msg = makeMessage({ senderType: 'duelist', senderId: req.duelistId, senderName: sender?.name || 'Unknown', text });
  const updated = [...messages, msg].slice(-MAX_MESSAGES);

  doc.data = setAtPath(doc.data, ['chat', 'dm', key], updated);
  doc.markModified('data');
  await doc.save();

  res.json({ success: true, message: msg });
});

module.exports = router;