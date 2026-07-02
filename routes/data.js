const express = require('express');
const Store = require('../models/Store');
const requireAdmin = require('../middleware/auth');

const router = express.Router();

// ── Helpers to walk a "path" like "duelists/d5" or "shop/budget" ──────────
function getAtPath(tree, segments) {
  let node = tree;
  for (const key of segments) {
    if (node == null || typeof node !== 'object') return null;
    node = node[key];
  }
  return node === undefined ? null : node;
}

function setAtPath(tree, segments, value) {
  if (segments.length === 0) return value;
  let node = tree;
  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i];
    if (node[key] == null || typeof node[key] !== 'object') node[key] = {};
    node = node[key];
  }
  node[segments[segments.length - 1]] = value;
  return tree;
}

function removeAtPath(tree, segments) {
  if (segments.length === 0) return {};
  let node = tree;
  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i];
    if (node[key] == null || typeof node[key] !== 'object') return tree; // nothing to remove
    node = node[key];
  }
  delete node[segments[segments.length - 1]];
  return tree;
}

async function loadTree() {
  let doc = await Store.findById('root');
  if (!doc) doc = await Store.create({ _id: 'root', data: {} });
  return doc;
}

// GET /api/data/*  — read a value at a path. Public (anyone can view the site's data).
router.get('/*', async (req, res) => {
  const segments = req.params[0].split('/').filter(Boolean);
  const doc = await loadTree();
  const value = getAtPath(doc.data, segments);
  res.json({ value });
});

// PUT /api/data/*  — overwrite the value at a path. Admin only.
router.put('/*', requireAdmin, async (req, res) => {
  const segments = req.params[0].split('/').filter(Boolean);
  const doc = await loadTree();
  doc.data = setAtPath(doc.data, segments, req.body.value);
  doc.markModified('data');
  await doc.save();
  res.json({ success: true });
});

// PATCH /api/data/*  — shallow-merge an object into the value at a path. Admin only.
router.patch('/*', requireAdmin, async (req, res) => {
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
router.delete('/*', requireAdmin, async (req, res) => {
  const segments = req.params[0].split('/').filter(Boolean);
  const doc = await loadTree();
  doc.data = removeAtPath(doc.data, segments);
  doc.markModified('data');
  await doc.save();
  res.json({ success: true });
});

module.exports = router;
