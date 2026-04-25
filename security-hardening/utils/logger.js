/**
 * BEEPREPARE — SECURITY LOGGER
 * Structured, tamper-evident logging for security events.
 * All security events get an HMAC signature so log tampering is detectable.
 *
 * DROP THIS FILE in: beeprepare-backend/utils/logger.js
 * (Replace or merge with your existing logger)
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const LOG_SECRET = process.env.ADMIN_JWT_SECRET || 'dev-log-secret';
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../logs');
const IS_PROD = process.env.NODE_ENV === 'production';

// Ensure log directory exists
try {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
} catch (_) {}

// ── HMAC Log Integrity ─────────────────────────────────────────────

const signLogEntry = (entry) => {
  const payload = JSON.stringify(entry);
  return crypto
    .createHmac('sha256', LOG_SECRET)
    .update(payload)
    .digest('hex')
    .substring(0, 16);
};

// ── Sanitize sensitive fields before logging ───────────────────────

const SENSITIVE_KEYS = [
  'password', 'pass', 'secret', 'token', 'key', 'apiKey',
  'authorization', 'cookie', 'utrNumber', 'upi', 'cardNumber',
  'cvv', 'otp', 'pin', 'privateKey', 'accessToken', 'refreshToken'
];

const sanitize = (obj, depth = 0) => {
  if (depth > 4 || !obj || typeof obj !== 'object') return obj;
  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some(sk => k.toLowerCase().includes(sk))) {
      clean[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null) {
      clean[k] = sanitize(v, depth + 1);
    } else {
      clean[k] = v;
    }
  }
  return clean;
};

// ── Log Levels ─────────────────────────────────────────────────────

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };
const MIN_LEVEL = IS_PROD ? LEVELS.info : LEVELS.debug;

// ── Core Log Writer ────────────────────────────────────────────────

const writeLog = (level, message, meta = {}) => {
  if (LEVELS[level] < MIN_LEVEL) return;

  const entry = {
    ts: new Date().toISOString(),
    level: level.toUpperCase(),
    msg: message,
    ...sanitize(meta),
  };

  // Add integrity signature to every log entry
  entry._sig = signLogEntry(entry);

  const line = JSON.stringify(entry);

  // Console output
  if (level === 'error' || level === 'fatal') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }

  // File output in production
  if (IS_PROD) {
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(LOG_DIR, `app-${date}.log`);
    const secFile = path.join(LOG_DIR, `security-${date}.log`);

    try {
      fs.appendFileSync(logFile, line + '\n');

      // Security events go to a separate file
      const securityPrefixes = ['[FORTRESS]', '[CSRF]', '[PAYMENT-SEC]', '[ADMIN-SEC]', '[AUDIT]'];
      if (securityPrefixes.some(p => message.startsWith(p)) || level === 'warn' || level === 'error') {
        fs.appendFileSync(secFile, line + '\n');
      }
    } catch (_) {
      // Log write failure — don't crash the server
    }
  }
};

// ── Public API ─────────────────────────────────────────────────────

const logger = {
  debug: (msg, meta) => writeLog('debug', msg, meta),
  info:  (msg, meta) => writeLog('info',  msg, meta),
  warn:  (msg, meta) => writeLog('warn',  msg, meta),
  error: (msg, meta) => writeLog('error', msg, meta),
  fatal: (msg, meta) => writeLog('fatal', msg, meta),

  // Security-specific convenience method
  security: (event, meta) => writeLog('warn', `[SECURITY] ${event}`, meta),

  // Request/response logger for Express
  requestLogger: (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      writeLog('info', '[REQUEST]', {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        ua: req.headers['user-agent']?.substring(0, 100),
        requestId: req.id,
      });
    });
    next();
  },

  // Verify a log entry's integrity
  verifyEntry: (entryString) => {
    try {
      const entry = typeof entryString === 'string'
        ? JSON.parse(entryString)
        : { ...entryString };
      const { _sig, ...rest } = entry;
      const expected = signLogEntry(rest);
      return crypto.timingSafeEqual(
        Buffer.from(_sig || ''),
        Buffer.from(expected)
      );
    } catch (_) {
      return false;
    }
  }
};

module.exports = logger;
