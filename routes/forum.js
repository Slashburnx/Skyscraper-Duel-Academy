const express = require('express');
const crypto = require('crypto');
const requireDuelist = require('../middleware/duelistAuth');
const requireModeratorOrAdmin = require('../middleware/moderatorAuth');
const { getAtPath, setAtPath, removeAtPath, loadTree } = require('../utils/tree');

const router = express.Router();

const DEFAULT_CATEGORIES = [
  { id: 'official-rules', name: 'Official Rules', icon: '📖', description: 'Official academy rules, posted by the moderators.' },
  { id: 'announcements',  name: 'Announcements',  icon: '📢', description: 'News and updates from the moderators.' },
  { id: 'rulings',        name: 'Rulings Questions', icon: '❓', description: 'Ask about card interactions, rulings, and mechanics.' },
  { id: 'general',        name: 'General Discussion', icon: '💬', description: 'Anything else — chat, strategy, banter.' },
];

async function ensureCategories(doc) {
  const existing = getAtPath(doc.data, ['forum', 'categories']);
  if (!existing) {
    const obj = {};
    DEFAULT_CATEGORIES.forEach(c => { obj[c.id] = c; });
    doc.data = setAtPath(doc.data, ['forum', 'categories'], obj);
    doc.markModified('data');
    await doc.save();
    return obj;
  }
  return existing;
}

// GET /api/forum/categories — public
router.get('/categories', async (req, res) => {
  const doc = await loadTree();
  const categories = await ensureCategories(doc);
  const threadsObj = getAtPath(doc.data, ['forum', 'threads']) || {};

  const list = Object.values(categories).map(c => ({
    ...c,
    threadCount: Object.values(threadsObj).filter(t => t.categoryId === c.id).length,
  }));
  res.json({ categories: list });
});

// GET /api/forum/threads?categoryId=X — public
router.get('/threads', async (req, res) => {
  const { categoryId } = req.query;
  const doc = await loadTree();
  const threadsObj = getAtPath(doc.data, ['forum', 'threads']) || {};

  let threads = Object.values(threadsObj);
  if (categoryId) threads = threads.filter(t => t.categoryId === categoryId);
  threads.sort((a, b) => (b.pinned - a.pinned) || (b.lastActivityAt - a.lastActivityAt));

  res.json({ threads });
});

// GET /api/forum/threads/:id — public, includes replies
router.get('/threads/:id', async (req, res) => {
  const doc = await loadTree();
  const thread = getAtPath(doc.data, ['forum', 'threads', req.params.id]);
  if (!thread) return res.status(404).json({ message: 'Thread not found.' });

  const replies = getAtPath(doc.data, ['forum', 'replies', req.params.id]) || [];
  res.json({ thread, replies });
});

// POST /api/forum/threads — requireDuelist { categoryId, title, body }
router.post('/threads', requireDuelist, async (req, res) => {
  const { categoryId, title, body } = req.body;
  if (!categoryId || !title || !title.trim() || !body || !body.trim()) {
    return res.status(400).json({ success: false, message: 'Category, title, and body are all required.' });
  }

  const doc = await loadTree();
  const categories = await ensureCategories(doc);
  if (!categories[categoryId]) return res.status(404).json({ success: false, message: 'Category not found.' });

  const duelistsObj = getAtPath(doc.data, ['duelists']) || {};
  const author = duelistsObj[req.duelistId];
  if (!author) return res.status(404).json({ success: false, message: 'Your duelist record was not found.' });

  const id = crypto.randomBytes(8).toString('hex');
  const thread = {
    id,
    categoryId,
    title: title.trim().slice(0, 150),
    body: body.trim().slice(0, 5000),
    authorId: req.duelistId,
    authorName: author.name,
    pinned: false,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };

  doc.data = setAtPath(doc.data, ['forum', 'threads', id], thread);
  doc.markModified('data');
  await doc.save();

  res.json({ success: true, thread });
});

// POST /api/forum/threads/:id/replies — requireDuelist { text }
router.post('/threads/:id/replies', requireDuelist, async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ success: false, message: 'Reply cannot be empty.' });

  const doc = await loadTree();
  const thread = getAtPath(doc.data, ['forum', 'threads', req.params.id]);
  if (!thread) return res.status(404).json({ success: false, message: 'Thread not found.' });

  const duelistsObj = getAtPath(doc.data, ['duelists']) || {};
  const author = duelistsObj[req.duelistId];
  if (!author) return res.status(404).json({ success: false, message: 'Your duelist record was not found.' });

  const replies = getAtPath(doc.data, ['forum', 'replies', req.params.id]) || [];
  const reply = {
    id: crypto.randomBytes(6).toString('hex'),
    authorId: req.duelistId,
    authorName: author.name,
    text: text.trim().slice(0, 2000),
    createdAt: Date.now(),
  };
  const updated = [...replies, reply];

  doc.data = setAtPath(doc.data, ['forum', 'replies', req.params.id], updated);
  doc.data = setAtPath(doc.data, ['forum', 'threads', req.params.id], { ...thread, lastActivityAt: Date.now() });
  doc.markModified('data');
  await doc.save();

  res.json({ success: true, reply });
});

// DELETE /api/forum/threads/:id — author OR moderator/admin
router.delete('/threads/:id', requireDuelist, async (req, res) => {
  const doc = await loadTree();
  const thread = getAtPath(doc.data, ['forum', 'threads', req.params.id]);
  if (!thread) return res.status(404).json({ success: false, message: 'Thread not found.' });

  const duelistsObj = getAtPath(doc.data, ['duelists']) || {};
  const me = duelistsObj[req.duelistId];
  const isModerator = me && (me.titles || []).includes('Moderator');
  if (thread.authorId !== req.duelistId && !isModerator) {
    return res.status(403).json({ success: false, message: 'You can only delete your own threads.' });
  }

  doc.data = removeAtPath(doc.data, ['forum', 'threads', req.params.id]);
  doc.data = removeAtPath(doc.data, ['forum', 'replies', req.params.id]);
  doc.markModified('data');
  await doc.save();

  res.json({ success: true });
});

// DELETE /api/forum/threads/:id/replies/:replyId — author OR moderator/admin
router.delete('/threads/:id/replies/:replyId', requireDuelist, async (req, res) => {
  const doc = await loadTree();
  const replies = getAtPath(doc.data, ['forum', 'replies', req.params.id]) || [];
  const reply = replies.find(r => r.id === req.params.replyId);
  if (!reply) return res.status(404).json({ success: false, message: 'Reply not found.' });

  const duelistsObj = getAtPath(doc.data, ['duelists']) || {};
  const me = duelistsObj[req.duelistId];
  const isModerator = me && (me.titles || []).includes('Moderator');
  if (reply.authorId !== req.duelistId && !isModerator) {
    return res.status(403).json({ success: false, message: 'You can only delete your own replies.' });
  }

  const updated = replies.filter(r => r.id !== req.params.replyId);
  doc.data = setAtPath(doc.data, ['forum', 'replies', req.params.id], updated);
  doc.markModified('data');
  await doc.save();

  res.json({ success: true });
});

// POST /api/forum/threads/:id/pin — moderator/admin only, toggles pinned
router.post('/threads/:id/pin', requireModeratorOrAdmin, async (req, res) => {
  const doc = await loadTree();
  const thread = getAtPath(doc.data, ['forum', 'threads', req.params.id]);
  if (!thread) return res.status(404).json({ success: false, message: 'Thread not found.' });

  doc.data = setAtPath(doc.data, ['forum', 'threads', req.params.id], { ...thread, pinned: !thread.pinned });
  doc.markModified('data');
  await doc.save();

  res.json({ success: true, pinned: !thread.pinned });
});

module.exports = router;