const jwt = require('jsonwebtoken');

// Protects write routes (create/update/delete). Read routes stay public so
// every visitor can see duelists, brackets, shop, etc. without logging in.
function requireAdmin(req, res, next) {
  const token = req.cookies.adminToken || req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Admin login required.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Session expired, please log in again.' });
  }
}

module.exports = requireAdmin;
