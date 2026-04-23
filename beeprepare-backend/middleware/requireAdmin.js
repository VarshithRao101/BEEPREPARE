const { verifyAdminToken } =
  require('../utils/adminAuth');
const AdminSession = require('../models/AdminSession');
const { error } =
  require('../utils/responseHelper');

const requireAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader ||
        !authHeader.startsWith('Bearer ')) {
      return error(res,
        'Admin authorization required',
        'ADMIN_AUTH_REQUIRED', 401
      );
    }
    const token = authHeader.split('Bearer ')[1];
    const decoded = verifyAdminToken(token);
    
    if (!decoded) {
      return error(res,
        'Invalid or expired admin session',
        'ADMIN_SESSION_INVALID', 401
      );
    }

    // NEW: Check if session was revoked
    const session = await AdminSession.findOne({ token, isRevoked: false });
    if (!session) {
      return error(res,
        'Session revoked or expired. Please login again.',
        'SESSION_REVOKED', 401
      );
    }

    req.admin = decoded;
    next();
  } catch (err) {
    console.error('requireAdmin error:', err.message);
    return error(res,
      'Admin authentication failed',
      'ADMIN_AUTH_ERROR', 401
    );
  }
};

module.exports = requireAdmin;
