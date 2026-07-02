const mongoose = require('mongoose');

// A single admin account for the whole site (the "mod/admin" the coder does
// not control). Password is always stored hashed, never in plain text.
const adminSchema = new mongoose.Schema({
  _id: { type: String, default: 'site-admin' },
  passwordHash: { type: String, required: true },
});

module.exports = mongoose.model('Admin', adminSchema);
