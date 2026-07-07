const express = require('express');
const requireModeratorOrAdmin = require('../middleware/moderatorAuth');
const { getAtPath, setAtPath, removeAtPath, loadTree } = require('../utils/tree');

const router = express.Router();

// GET /api/data/*  — read a value at a path. Public (anyone can view the site's data).
router.get('/*', async (req, res) => {
  const segments = req.params[0].split('/').filter(Boolean);
  const doc = await loadTree();
  const value = getAtPath(doc.data, segments);
  res.json({ value });
});

// PUT /api/data/*  — overwrite the value at a path. Admin only.
router.put('/*', requireModeratorOrAdmin, async (req, res) => {
  const segments = req.params[0].split('/').filter(Boolean);
  const doc = await loadTree();
  doc.data = setAtPath(doc.data, segments, req.body.value);
  doc.markModified('data');
  await doc.save();
  res.json({ success: true });
});

// PATCH /api/data/*  — shallow-merge an object into the value at a path. Admin only.
router.patch('/*', requireModeratorOrAdmin, async (req, res) => {
  const segments = req.params[0].split('/').filter(Boolean);
  const doc = await loadTree();
  const current = getAtPath(doc.data, segments) || {};
  const merged = { ...(typeof current === 'object' ? current : {}), ...req.body.value };
  doc.data = setAtPath(doc.data, segments, merged);
  doc.markModified('data');
  await doc.save();
  res.json({ success: true });
});

// DELETE /api/data/*  — remove the value at a path. Admin only.
router.delete('/*', requireModeratorOrAdmin, async (req, res) => {
  const segments = req.params[0].split('/').filter(Boolean);
  const doc = await loadTree();
  doc.data = removeAtPath(doc.data, segments);
  doc.markModified('data');
  await doc.save();
  res.json({ success: true });
});

module.exports = router;