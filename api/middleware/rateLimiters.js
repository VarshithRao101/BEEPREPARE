const rateLimit = require('express-rate-limit');

// Brute-force protection for Login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 50, // 50 attempts (Relaxed from 5 for better UX)
  message: {
    success: false,
    message: 'Too many login attempts from this IP. Please try again after 15 minutes.',
    error: { code: 'BRUTE_FORCE_LOGIN' }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Strict protection for License/Redeem key verification (Step 1)
const verificationLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 10,              // 10 attempts (Relaxed from 3)
  keyGenerator: (req) => String(req.user?.googleUid || req.ip || '127.0.0.1'), // Limit per user if possible
  message: {
    success: false,
    message: 'System Busy. Please wait 10 seconds between verification attempts.',
    error: { code: 'CLIENT_RATE_LIMIT' }
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { loginLimiter, verificationLimiter };
