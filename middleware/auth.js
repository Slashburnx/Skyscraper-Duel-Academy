const jwt = require('jsonwebtoken');

// Protects write routes (create/update/delete). Read routes stay public so
// every visitor can see duelists, brackets, shop, etc. without logging in.
//
// IMPORTANT: this checks decoded.role === 'admin' explicitly. Duelist login
// tokens are signed with this same JWT_SECRET (see middleware/duelistAuth.js),
// so just verifying the signature isn't enough — without the role check, a
// duelist could rename their own cookie to "adminToken" and be treated as
// an admin, since their token would still verify successfully.
function requireAdmin(req, res, next) {
  const token = req.cookies.adminToken || req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Admin login required.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Session expired, please log in again.' });
  }
}

module.exports = requireAdmin;