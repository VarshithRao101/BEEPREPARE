const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

// Store for tracking attempts
const attemptStore = new Map();

// Clean store every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of attemptStore.entries()) {
    if (now - data.firstAttempt > 60 * 60 * 1000) {
      attemptStore.delete(key);
    }
  }
}, 60 * 60 * 1000);

// Global limiter — Relaxed for better performance
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300, // Increased from 100
  validate: { default: false },
  message: {
    success: false,
    message: 'Too many requests.',
    error: { code: 'RATE_LIMITED' }
  },
  skip: (req) => req.bypassRateLimit === true
});

// Auth limiter (strict)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  validate: { default: false },
  message: {
    success: false,
    message: 'Too many auth attempts.',
    error: { code: 'AUTH_RATE_LIMITED' }
  },
  skipSuccessfulRequests: true,
  skip: (req) => req.bypassRateLimit === true
});

// Activation limiter
const activationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  // Standardized IP detection for activation
  validate: { default: false },
  message: {
    success: false,
    message: 'Too many activation attempts.',
    error: { code: 'ACTIVATION_RATE_LIMITED' }
  },
  skip: (req) => req.bypassRateLimit === true
});

// AI limiter (per user)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user?.googleUid || req.ip || 'anonymous',
  validate: { default: false },
  message: {
    success: false,
    message: 'Too many AI requests.',
    error: { code: 'AI_RATE_LIMITED' }
  },
  skip: (req) => req.bypassRateLimit === true
});

// OTP limiter (very strict)
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => (req.user?.googleUid || req.ip || 'anonymous') + '_otp',
  validate: { default: false },
  message: {
    success: false,
    message: 'Too many OTP attempts.',
    error: { code: 'OTP_RATE_LIMITED' }
  },
  skip: (req) => req.bypassRateLimit === true
});

// Payment submission limiter
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.body?.email || req.ip || 'anonymous',
  validate: { default: false },
  message: {
    success: false,
    message: 'Too many payment submissions.',
    error: { code: 'PAYMENT_RATE_LIMITED' }
  },
  skip: (req) => req.bypassRateLimit === true
});

// Upload limiter
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user?.googleUid || req.ip || 'anonymous',
  validate: { default: false },
  message: {
    success: false,
    message: 'Upload limit reached.',
    error: { code: 'UPLOAD_RATE_LIMITED' }
  },
  skip: (req) => req.bypassRateLimit === true
});

// Slow down repeated requests — Optimized to be less intrusive
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 200, // Increased from 50
  delayMs: () => 100, // Reduced from 500
  skip: (req) => req.bypassRateLimit === true
});

module.exports = {
  globalLimiter,
  authLimiter,
  activationLimiter,
  aiLimiter,
  otpLimiter,
  paymentLimiter,
  uploadLimiter,
  speedLimiter
};
