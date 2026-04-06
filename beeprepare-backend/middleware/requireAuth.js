const { admin } = require('../config/firebase');
const User = require('../models/User');
const { error } = require('../utils/responseHelper');

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader ||
        !authHeader.startsWith('Bearer ')) {
      return error(res,
        'Authorization token required',
        'MISSING_TOKEN', 401
      );
    }

    const token = authHeader.split('Bearer ')[1];

    let decoded;
    try {
      decoded = await admin.auth()
        .verifyIdToken(token);
    } catch (tokenErr) {
      return error(res,
        'Invalid or expired token',
        'INVALID_TOKEN', 401
      );
    }

    const user = await User.findOne({
      googleUid: decoded.uid
    });

    if (!user) {
      return error(res,
        'User not found. Please sign in again.',
        'USER_NOT_FOUND', 401
      );
    }

    // Self-healing: fix activation if needed
    if (user.licenseKey && !user.isActivated) {
      await User.updateOne(
        { googleUid: decoded.uid },
        { isActivated: true }
      );
      user.isActivated = true;
    }

    req.user = user;
    next();

  } catch (err) {
    console.error('requireAuth error:', err);
    return error(res,
      'Authentication failed',
      'AUTH_ERROR', 401
    );
  }
};

module.exports = requireAuth;
