/**
 * BEEPREPARE — CSRF PROTECTION LAYER
 * Double-submit cookie + signed token pattern.
 * Since you use Firebase Auth (Bearer tokens), full CSRF is less critical
 * for API routes — but admin panel routes and payment endpoints need it.
 *
 * DROP THIS FILE in: beeprepare-backend/middleware/csrf.js
 */

'use strict';

const crypto = require('crypto');
const logger = require('../utils/logger');

const CSRF_SECRET = process.env.ADMIN_JWT_SECRET || 'fallback-should-never-happen';
const CSRF_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ── Token Generation ──────────────────────────────────────────────

const generateCsrfToken = (sessionId) => {
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = `${sessionId}|${timestamp}|${nonce}`;
  const signature = crypto
    .createHmac('sha256', CSRF_SECRET)
    .update(payload)
    .digest('hex');
  const token = Buffer.from(`${payload}|${signature}`).toString('base64url');
  return { token, expiresAt: timestamp + CSRF_TOKEN_TTL_MS };
};

const verifyCsrfToken = (token, sessionId) => {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split('|');
    if (parts.length !== 4) return false;

    const [storedSession, timestamp, nonce, signature] = parts;

    // Check session match
    if (storedSession !== sessionId) return false;

    // Check expiry
    if (Date.now() - parseInt(timestamp, 10) > CSRF_TOKEN_TTL_MS) return false;

    // Verify signature
    const payload = `${storedSession}|${timestamp}|${nonce}`;
    const expectedSig = crypto
      .createHmac('sha256', CSRF_SECRET)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSig, 'hex')
    );
  } catch (_) {
    return false;
  }
};

// ── Endpoint: GET /api/csrf-token ─────────────────────────────────
// Call this from your admin panel before any state-changing request.

const csrfTokenEndpoint = (req, res) => {
  const sessionId = req.admin?.adminId || req.user?.googleUid || req.ip;
  const { token, expiresAt } = generateCsrfToken(sessionId);
  res.json({ success: true, data: { csrfToken: token, expiresAt } });
};

// ── Middleware: Validate CSRF on admin mutations ──────────────────

const requireCsrf = (req, res, next) => {
  // Only enforce on state-changing methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  const token =
    req.headers['x-csrf-token'] ||
    req.headers['x-xsrf-token'] ||
    req.body?._csrf;

  if (!token) {
    logger.warn('[CSRF] Missing CSRF token', { ip: req.ip, url: req.originalUrl });
    return res.status(403).json({
      success: false,
      message: 'CSRF token required.',
      error: { code: 'CSRF_REQUIRED' }
    });
  }

  const sessionId = req.admin?.adminId || req.user?.googleUid || req.ip;

  if (!verifyCsrfToken(token, sessionId)) {
    logger.warn('[CSRF] Invalid or expired CSRF token', {
      ip: req.ip, url: req.originalUrl, sessionId
    });
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired CSRF token.',
      error: { code: 'CSRF_INVALID' }
    });
  }

  next();
};

module.exports = { requireCsrf, csrfTokenEndpoint, generateCsrfToken, verifyCsrfToken };
