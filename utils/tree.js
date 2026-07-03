const Store = require('../models/Store');

// ── Walk a "path" like "duelists/d5" or "shop/budget" through the tree ────
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

module.exports = { getAtPath, setAtPath, removeAtPath, loadTree };