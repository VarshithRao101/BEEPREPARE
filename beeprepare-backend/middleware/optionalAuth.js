'use strict';

const { admin } = require('../config/firebase');
const User = require('../models/User');
const Blacklist = require('../models/Blacklist');
const { getClientIp } = require('./security');

const tokenCache = new Map();
const TOKEN_CACHE_TTL = 5 * 60 * 1000;

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [token, data] of tokenCache.entries()) {
    if (!data || now - data.cachedAt > TOKEN_CACHE_TTL) {
      tokenCache.delete(token);
    }
  }
}, 10 * 60 * 1000);

if (typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

const optionalAuth = async (req, res, next) => {
  req.requestIp = getClientIp(req);

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token || token.length < 10) {
    return next();
  }

  try {
    let decoded;
    const cached = tokenCache.get(token);

    if (cached && Date.now() - cached.cachedAt < TOKEN_CACHE_TTL) {
      decoded = cached.decoded;
    } else {
      decoded = await admin.auth().verifyIdToken(token, true);
      tokenCache.set(token, {
        decoded,
        cachedAt: Date.now()
      });
    }

    const user = await User.findOne(
      { googleUid: decoded.uid },
      '-otpHash -__v'
    ).lean();

    if (!user || user.isBlocked) {
      return next();
    }

    const blacklisted = await Blacklist.findOne({
      email: user.email,
      isActive: true
    }).lean();

    if (blacklisted) {
      return next();
    }

    req.user = user;
    return next();
  } catch (err) {
    tokenCache.delete(token);
    return next();
  }
};

module.exports = optionalAuth;
