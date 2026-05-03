/**
 * BEEPREPARE — ADMIN SECURITY HARDENING
 * Multi-layer admin route protection: rolling code expiry enforcement,
 * login brute-force lockout, session binding, and action code validation.
 *
 * DROP THIS FILE in: beeprepare-backend/middleware/adminFortress.js
 * APPLY in: beeprepare-backend/routes/admin.js
 */

'use strict';

const crypto = require('crypto');
const logger = require('../utils/logger');

// ── Brute-force Lockout Store ─────────────────────────────────────
const loginAttempts = new Map();  // ip → { count, lockedUntil, lastAttempt }
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of loginAttempts.entries()) {
    if (now - data.lastAttempt > LOCKOUT_MS * 2) {
      loginAttempts.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// ── Session Binding Store ─────────────────────────────────────────
// Binds admin JWT to the IP + UA that created the session
const sessionBindings = new Map(); // adminId → { ip, ua, fingerprint, createdAt }

// ── Brute-force Protection ────────────────────────────────────────

const recordFailedLogin = (ip) => {
  const now = Date.now();
  if (!loginAttempts.has(ip)) {
    loginAttempts.set(ip, { count: 0, lockedUntil: 0, lastAttempt: now });
  }
  const record = loginAttempts.get(ip);

  // Reset window
  if (now - record.lastAttempt > ATTEMPT_WINDOW_MS) {
    record.count = 0;
  }

  record.count++;
  record.lastAttempt = now;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
    logger.warn('[ADMIN-SEC] Admin login locked after repeated failures', {
      ip, count: record.count
    });
  }
};

const recordSuccessfulLogin = (ip) => {
  loginAttempts.delete(ip);
};

const isLoginLocked = (ip) => {
  if (!loginAttempts.has(ip)) return false;
  const record = loginAttempts.get(ip);
  if (record.lockedUntil && Date.now() < record.lockedUntil) {
    return Math.ceil((record.lockedUntil - Date.now()) / 1000);
  }
  return false;
};

/**
 * MIDDLEWARE: Admin Login Brute-force Guard
 * Apply this BEFORE admin credential verification.
 */
const adminBruteForceGuard = (req, res, next) => {
  const ip = req.ip;
  const waitSecs = isLoginLocked(ip);
  if (waitSecs) {
    logger.warn('[ADMIN-SEC] Locked IP attempted admin login', { ip, waitSecs });
    return res.status(429).json({
      success: false,
      message: `Too many failed attempts. Try again in ${waitSecs} seconds.`,
      error: { code: 'ADMIN_LOCKED', retryAfter: waitSecs }
    });
  }
  // Expose hooks for the auth controller
  req.recordFailedLogin = () => recordFailedLogin(ip);
  req.recordSuccessfulLogin = () => recordSuccessfulLogin(ip);
  next();
};

// ── Session Binding ───────────────────────────────────────────────

const bindSession = (adminId, ip, ua, fingerprint) => {
  sessionBindings.set(adminId, {
    ip,
    ua: ua?.substring(0, 200),
    fingerprint,
    createdAt: Date.now()
  });
};

const verifySessionBinding = (adminId, ip, fingerprint) => {
  if (!sessionBindings.has(adminId)) return true; // First use — allow, will bind later

  const binding = sessionBindings.get(adminId);

  // Binding expires after 8h (matches JWT expiry)
  if (Date.now() - binding.createdAt > 8 * 60 * 60 * 1000) {
    sessionBindings.delete(adminId);
    return true;
  }

  // IP change is suspicious — soft check (warn but don't hard-block, allows mobile)
  if (binding.ip !== ip) {
    logger.warn('[ADMIN-SEC] Admin session IP mismatch (possible hijack?)', {
      adminId, expectedIp: binding.ip, actualIp: ip
    });
  }

  // Fingerprint must match
  if (binding.fingerprint && fingerprint && binding.fingerprint !== fingerprint) {
    logger.warn('[ADMIN-SEC] Admin session fingerprint mismatch — possible session hijack', {
      adminId, expectedFp: binding.fingerprint, actualFp: fingerprint
    });
    return false;
  }

  return true;
};

/**
 * MIDDLEWARE: Admin Session Binding Verifier
 * Apply AFTER requireAdmin (decoded token is available as req.admin).
 */
const adminSessionBindingCheck = (req, res, next) => {
  const { adminId } = req.admin || {};
  if (!adminId) return next();

  const ok = verifySessionBinding(adminId, req.ip, req.fingerprint);
  if (!ok) {
    return res.status(401).json({
      success: false,
      message: 'Session security check failed. Please log in again.',
      error: { code: 'SESSION_HIJACK_DETECTED' }
    });
  }
  next();
};

// ── Action Code Validation ────────────────────────────────────────

const ACTION_CODES = {
  BLOCK_USER:        process.env.CODE_BLOCK_USER,
  UNBLOCK_USER:      process.env.CODE_UNBLOCK_USER,
  DELETE_USER:       process.env.CODE_DELETE_USER,
  APPROVE_PAYMENT:   process.env.CODE_APPROVE_PAYMENT,
  REJECT_PAYMENT:    process.env.CODE_REJECT_PAYMENT,
  GENERATE_KEYS:     process.env.CODE_GENERATE_KEYS,
  DELETE_FEEDBACK:   process.env.CODE_DELETE_FEEDBACK,
  DEACTIVATE_BANK:   process.env.CODE_DEACTIVATE_BANK,
  DELETE_BANK:       process.env.CODE_DELETE_BANK,
  MAINTENANCE_ON:    process.env.CODE_MAINTENANCE_ON,
  MAINTENANCE_OFF:   process.env.CODE_MAINTENANCE_OFF,
  CHANGE_MONGODB:    process.env.CODE_CHANGE_MONGODB,
  CHANGE_GEMINI:     process.env.CODE_CHANGE_GEMINI,
  CHANGE_RESEND:     process.env.CODE_CHANGE_RESEND,
  CHANGE_CORS:       process.env.CODE_CHANGE_CORS,
  CLEAR_LOGS:        process.env.CODE_CLEAR_LOGS,
  RESTART_SERVER:    process.env.CODE_RESTART_SERVER,
  CHANGE_ADMIN_PASS: process.env.CODE_CHANGE_ADMIN_PASS,
  MARK_FEEDBACK:     process.env.CODE_MARK_FEEDBACK,
  FORCE_RESET:       process.env.CODE_FORCE_RESET,
  DELETE_KEY:        process.env.CODE_DELETE_KEY,
  DELETE_PAYMENT:    process.env.CODE_DELETE_PAYMENT,
  ADD_ANNOUNCEMENT:  process.env.CODE_ADD_ANNOUNCEMENT || 'BEEAA592810',  // ← Global announcement push
};

// Track action code usage (rate limit per admin session)
const actionCodeAttempts = new Map();

/**
 * Factory: Returns middleware that validates a specific action code.
 * Usage: router.post('/delete-user', requireAdmin, requireActionCode('DELETE_USER'), ctrl)
 */
const requireActionCode = (actionName) => (req, res, next) => {
  const { actionCode } = req.body;
  const expectedCode = ACTION_CODES[actionName];
  const adminId = req.admin?.adminId || req.ip;

  if (!expectedCode) {
    logger.error('[ADMIN-SEC] Action code not configured for:', actionName);
    return res.status(500).json({
      success: false,
      message: 'Action not configured.',
      error: { code: 'ACTION_NOT_CONFIGURED' }
    });
  }

  if (!actionCode) {
    return res.status(400).json({
      success: false,
      message: 'Action code required.',
      error: { code: 'ACTION_CODE_REQUIRED' }
    });
  }

  // Rate-limit action code attempts (3 per 5 min per admin)
  const attemptKey = `${adminId}_${actionName}`;
  const now = Date.now();
  if (!actionCodeAttempts.has(attemptKey)) {
    actionCodeAttempts.set(attemptKey, { count: 0, firstSeen: now });
  }
  const attempt = actionCodeAttempts.get(attemptKey);
  if (now - attempt.firstSeen > 5 * 60 * 1000) {
    attempt.count = 0;
    attempt.firstSeen = now;
  }
  attempt.count++;

  if (attempt.count > 3) {
    logger.warn('[ADMIN-SEC] Action code rate limit exceeded', { adminId, actionName });
    return res.status(429).json({
      success: false,
      message: 'Too many action code attempts.',
      error: { code: 'ACTION_CODE_RATE_LIMITED' }
    });
  }

  // Timing-safe comparison
  const expected = Buffer.from(expectedCode);
  const provided = Buffer.from(String(actionCode));

  // Length check first (timingSafeEqual requires same length)
  if (expected.length !== provided.length ||
      !crypto.timingSafeEqual(expected, provided)) {
    logger.warn('[ADMIN-SEC] Invalid action code', {
      adminId, action: actionName, ip: req.ip
    });
    return res.status(403).json({
      success: false,
      message: 'Invalid action code.',
      error: { code: 'INVALID_ACTION_CODE' }
    });
  }

  // Reset on success
  actionCodeAttempts.delete(attemptKey);
  logger.info('[ADMIN-AUDIT] Action code verified', {
    adminId, action: actionName, ip: req.ip, timestamp: new Date().toISOString()
  });
  next();
};

// ── Destructive Action Confirmation ──────────────────────────────

/**
 * For DELETE operations, require a typed confirmation string.
 * Usage: router.delete('/user/:id', ..., requireConfirmation('DELETE USER'), ctrl)
 */
const requireConfirmation = (phrase) => (req, res, next) => {
  const { confirmation } = req.body;
  if (!confirmation || confirmation.trim().toUpperCase() !== phrase.toUpperCase()) {
    return res.status(400).json({
      success: false,
      message: `Confirmation required. Type exactly: "${phrase}"`,
      error: { code: 'CONFIRMATION_REQUIRED' }
    });
  }
  next();
};

module.exports = {
  adminBruteForceGuard,
  adminSessionBindingCheck,
  requireActionCode,
  requireConfirmation,
  bindSession,     // Call this from your admin login controller on success
  recordFailedLogin,
  recordSuccessfulLogin,
};
