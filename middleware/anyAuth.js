const jwt = require('jsonwebtoken');

// Chat is the first feature where EITHER an admin OR a duelist may act.
// This checks both cookies and attaches a normalized req.actor so routes
// don't need to care which kind of account is talking.
function requireAnyLogin(req, res, next) {
  const adminTok   = req.cookies.adminToken;
  const duelistTok = req.cookies.duelistToken;

  if (adminTok) {
    try {
      const decoded = jwt.verify(adminTok, process.env.JWT_SECRET);
      if (decoded.role === 'admin') {
        req.actor = { type: 'admin', id: 'admin', name: 'Admin' };
        return next();
      }
    } catch { /* fall through to try duelist token */ }
  }

  if (duelistTok) {
    try {
      const decoded = jwt.verify(duelistTok, process.env.JWT_SECRET);
      if (decoded.role === 'duelist' && decoded.duelistId) {
        req.actor = { type: 'duelist', id: decoded.duelistId, name: null }; // name filled in by the route when needed
        return next();
      }
    } catch { /* neither token worked */ }
  }

  return res.status(401).json({ success: false, message: 'Please log in as admin or a duelist.' });
}

module.exports = requireAnyLogin;