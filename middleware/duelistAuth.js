const jwt = require('jsonwebtoken');

// Verifies a duelist is logged in as themselves. Separate cookie AND separate
// role check from admin sessions — see middleware/auth.js for why the role
// check matters (both token types share the same JWT_SECRET).
function requireDuelist(req, res, next) {
  const token = req.cookies.duelistToken;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'duelist' || !decoded.duelistId) {
      return res.status(403).json({ success: false, message: 'Invalid session.' });
    }
    req.duelistId = decoded.duelistId;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Session expired, please log in again.' });
  }
}

module.exports = requireDuelist;