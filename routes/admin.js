const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const requireAdmin = require('../middleware/auth');

const router = express.Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 1000 * 60 * 60 * 12, // 12 hours
};

// POST /api/admin/login  { password }
router.post('/login', async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, message: 'Password is required.' });
  }

  const admin = await Admin.findById('site-admin');
  if (!admin) {
    return res.status(500).json({ success: false, message: 'Admin account not set up yet.' });
  }

  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) {
    return res.status(401).json({ success: false, message: 'Wrong password. Try again.' });
  }

  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.cookie('adminToken', token, COOKIE_OPTS);
  res.json({ success: true });
});

// POST /api/admin/logout
router.post('/logout', (req, res) => {
  res.clearCookie('adminToken');
  res.json({ success: true });
});

// GET /api/admin/check — is the current visitor logged in as admin?
router.get('/check', (req, res) => {
  const token = req.cookies.adminToken;
  if (!token) return res.json({ isAdmin: false });
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    res.json({ isAdmin: true });
  } catch {
    res.json({ isAdmin: false });
  }
});

// POST /api/admin/change-password  { currentPassword, newPassword }  (must be logged in)
router.post('/change-password', requireAdmin, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Both fields are required.' });
  }

  const admin = await Admin.findById('site-admin');
  const ok = await bcrypt.compare(currentPassword, admin.passwordHash);
  if (!ok) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
  }

  admin.passwordHash = await bcrypt.hash(newPassword, 10);
  await admin.save();
  res.json({ success: true });
});

module.exports = router;
