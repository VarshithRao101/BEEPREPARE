const { admin } = require('../config/firebase');
const User = require('../models/User');
const Blacklist = require('../models/Blacklist');
const { error } = require('../utils/responseHelper');
const { getClientIp } = require('./security');

// Token cache to reduce Firebase calls
const tokenCache = new Map();
const TOKEN_CACHE_TTL = 5 * 60 * 1000;

// Clean cache every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of tokenCache.entries()) {
    if (now - data.cachedAt > TOKEN_CACHE_TTL) {
      tokenCache.delete(key);
    }
  }
}, 10 * 60 * 1000);

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res,
        'Authorization required.',
        'MISSING_TOKEN', 401);
    }

    const token = authHeader.split('Bearer ')[1]?.trim();

    if (!token || token.length < 10) {
      return error(res,
        'Invalid token format.',
        'INVALID_TOKEN', 401);
    }

    // Check token cache first
    let decoded;
    const cached = tokenCache.get(token);
    if (cached && Date.now() - cached.cachedAt < TOKEN_CACHE_TTL) {
      decoded = cached.decoded;
    } else {
      try {
        decoded = await admin.auth().verifyIdToken(token, true);
        // Cache valid token
        tokenCache.set(token, {
          decoded,
          cachedAt: Date.now()
        });
      } catch (tokenErr) {
        // Clear from cache if invalid
        tokenCache.delete(token);
        return error(res,
          'Invalid or expired token.',
          'INVALID_TOKEN', 401);
      }
    }

    // Get user from MongoDB
    const user = await User.findOne(
      { googleUid: decoded.uid },
      // Never return sensitive fields
      '-otpHash -__v'
    ).lean();

    if (!user) {
      return error(res,
        'User not found.',
        'USER_NOT_FOUND', 401);
    }

    // Check if blocked
    if (user.isBlocked) {
      return error(res,
        'Account suspended. Contact support.',
        'ACCOUNT_BLOCKED', 403);
    }

    // Check blacklist
    const blacklisted = await Blacklist.findOne({
      email: user.email,
      isActive: true
    }).lean();

    if (blacklisted) {
      return error(res,
        'Access denied.',
        'ACCOUNT_BLACKLISTED', 403);
    }

    // Self-healing activation
    if (user.licenseKey && !user.isActivated) {
      await User.updateOne(
        { googleUid: decoded.uid },
        { isActivated: true, planType: 'active' }
      );
      user.isActivated = true;
      user.planType = 'active';
    }

    // Attach user and request metadata
    req.user = user;
    req.requestIp = getClientIp(req);
    next();

  } catch (err) {
    console.error('requireAuth error:', err.message);
    return error(res,
      'Authentication failed.',
      'AUTH_ERROR', 401);
  }
};

module.exports = requireAuth;
