const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getAtPath, setAtPath, loadTree } = require('../utils/tree');
const requireDuelist = require('../middleware/duelistAuth');

const router = express.Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 1000 * 60 * 60 * 24 * 14, // 14 days
};

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

function signDuelistToken(duelistId) {
  return jwt.sign({ role: 'duelist', duelistId }, process.env.JWT_SECRET, { expiresIn: '14d' });
}

// GET /api/duelist-auth/invite/:token — check an invite link is valid, before showing the claim form.
router.get('/invite/:token', async (req, res) => {
  const { token } = req.params;
  const doc = await loadTree();
  const duelistsObj = getAtPath(doc.data, ['duelists']) || {};

  const match = Object.entries(duelistsObj).find(
    ([, d]) => d && d.inviteToken === token
  );

  if (!match) {
    return res.status(404).json({ valid: false, message: 'This invite link is invalid or has already been used.' });
  }

  const [id, duelist] = match;
  if (duelist.inviteExpiresAt && Date.now() > duelist.inviteExpiresAt) {
    return res.status(410).json({ valid: false, message: 'This invite link has expired. Ask the admin for a new one.' });
  }
  if (duelist.accountActive) {
    return res.status(409).json({ valid: false, message: 'This account has already been set up. Try logging in instead.' });
  }

  res.json({ valid: true, duelistId: id, name: duelist.name });
});

// POST /api/duelist-auth/claim  { token, username, password } — sets up the account for real.
router.post('/claim', async (req, res) => {
  const { token, username, password } = req.body;

  if (!token || !username || !password) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ success: false, message: 'Username must be 3-20 characters, letters/numbers/underscores only.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
  }

  const doc = await loadTree();
  const duelistsObj = getAtPath(doc.data, ['duelists']) || {};

  const match = Object.entries(duelistsObj).find(([, d]) => d && d.inviteToken === token);
  if (!match) {
    return res.status(404).json({ success: false, message: 'This invite link is invalid or has already been used.' });
  }
  const [id, duelist] = match;
  if (duelist.accountActive) {
    return res.status(409).json({ success: false, message: 'This account has already been set up.' });
  }
  if (duelist.inviteExpiresAt && Date.now() > duelist.inviteExpiresAt) {
    return res.status(410).json({ success: false, message: 'This invite link has expired. Ask the admin for a new one.' });
  }

  if (findDuelistByUsername(duelistsObj, username)) {
    return res.status(409).json({ success: false, message: 'That username is already taken.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const updated = {
    ...duelist,
    username,
    passwordHash,
    accountActive: true,
    inviteToken: null,
    inviteExpiresAt: null,
  };
  doc.data = setAtPath(doc.data, ['duelists', id], updated);
  doc.markModified('data');
  await doc.save();

  const jwtToken = signDuelistToken(id);
  res.cookie('duelistToken', jwtToken, COOKIE_OPTS);
  res.json({ success: true, duelistId: id, name: duelist.name });
});

// POST /api/duelist-auth/login  { username, password }
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }

  const doc = await loadTree();
  const duelistsObj = getAtPath(doc.data, ['duelists']) || {};
  const match = findDuelistByUsername(duelistsObj, username);

  if (!match || !match.duelist.passwordHash) {
    return res.status(401).json({ success: false, message: 'Wrong username or password.' });
  }

  const ok = await bcrypt.compare(password, match.duelist.passwordHash);
  if (!ok) {
    return res.status(401).json({ success: false, message: 'Wrong username or password.' });
  }

  const jwtToken = signDuelistToken(match.id);
  res.cookie('duelistToken', jwtToken, COOKIE_OPTS);
  res.json({ success: true, duelistId: match.id, name: match.duelist.name });
});

// POST /api/duelist-auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('duelistToken');
  res.json({ success: true });
});

// GET /api/duelist-auth/check — is the current visitor logged in as a duelist?
router.get('/check', async (req, res) => {
  const token = req.cookies.duelistToken;
  if (!token) return res.json({ loggedIn: false });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'duelist' || !decoded.duelistId) return res.json({ loggedIn: false });

    const doc = await loadTree();
    const duelist = getAtPath(doc.data, ['duelists', decoded.duelistId]);
    if (!duelist) return res.json({ loggedIn: false });

    res.json({ loggedIn: true, duelistId: decoded.duelistId, name: duelist.name });
  } catch {
    res.json({ loggedIn: false });
  }
});

// PUT /api/duelist-auth/me/avatar  { url } — a duelist sets their OWN profile picture.
// Scoped narrowly on purpose: this is the only field a duelist can write directly,
// everything else (DP, archetypes, dorm, etc.) still goes through admin or the
// request/approval system.
router.put('/me/avatar', requireDuelist, async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string' || !url.startsWith('https://')) {
    return res.status(400).json({ success: false, message: 'Invalid image URL.' });
  }

  const doc = await loadTree();
  const duelist = getAtPath(doc.data, ['duelists', req.duelistId]);
  if (!duelist) return res.status(404).json({ success: false, message: 'Duelist not found.' });

  doc.data = setAtPath(doc.data, ['duelists', req.duelistId], { ...duelist, profilePicUrl: url });
  doc.markModified('data');
  await doc.save();

  res.json({ success: true, profilePicUrl: url });
});

module.exports = router;