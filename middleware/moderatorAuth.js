const jwt = require('jsonwebtoken');
const { getAtPath, loadTree } = require('../utils/tree');

// Protects the same write routes requireAdmin used to, but now ALSO accepts
// a duelist logged into their own account who currently holds the
// "Moderator" role. Deliberately does a live database check rather than
// trusting anything baked into the JWT — roles can be revoked, and a stale
// token claiming "still a moderator" would be a real security hole.
async function requireModeratorOrAdmin(req, res, next) {
  const adminTok = req.cookies.adminToken;
  if (adminTok) {
    try {
      const decoded = jwt.verify(adminTok, process.env.JWT_SECRET);
      if (decoded.role === 'admin') {
        req.actor = { type: 'admin' };
        return next();
      }
    } catch { /* fall through and try duelist/moderator */ }
  }

  const duelistTok = req.cookies.duelistToken;
  if (duelistTok) {
    try {
      const decoded = jwt.verify(duelistTok, process.env.JWT_SECRET);
      if (decoded.role === 'duelist' && decoded.duelistId) {
        const doc = await loadTree();
        const duelist = getAtPath(doc.data, ['duelists', decoded.duelistId]);
        if (duelist && (duelist.titles || []).includes('Moderator')) {
          req.actor = { type: 'moderator', duelistId: decoded.duelistId, name: duelist.name };
          return next();
        }
      }
    } catch { /* neither token worked */ }
  }

  return res.status(403).json({ success: false, message: 'Admin or Moderator access required.' });
}

module.exports = requireModeratorOrAdmin;