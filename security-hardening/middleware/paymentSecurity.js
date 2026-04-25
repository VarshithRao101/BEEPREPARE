/**
 * BEEPREPARE — PAYMENT SECURITY LAYER
 * Idempotency, UTR deduplication, fraud fingerprinting,
 * tamper detection, and payment flow integrity.
 *
 * DROP THIS FILE in: beeprepare-backend/middleware/paymentSecurity.js
 * ADD THESE MIDDLEWARES to: beeprepare-backend/routes/payment.js
 */

'use strict';

const crypto = require('crypto');
const logger = require('../utils/logger');

// ── In-memory UTR dedup (use Redis in production) ─────────────────
const processedUTRs = new Map();          // UTR → { processedAt, ip }
const pendingUTRs = new Map();            // UTR → { submittedAt, ip, attempts }
const idempotencyStore = new Map();       // idempotency-key → response

// Purge after 24h
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [k, v] of processedUTRs.entries()) {
    if (v.processedAt < cutoff) processedUTRs.delete(k);
  }
  for (const [k, v] of pendingUTRs.entries()) {
    if (v.submittedAt < cutoff) pendingUTRs.delete(k);
  }
  for (const [k, v] of idempotencyStore.entries()) {
    if (v.storedAt < cutoff) idempotencyStore.delete(k);
  }
}, 60 * 60 * 1000);

// ── UTR Deduplication ─────────────────────────────────────────────

/**
 * Blocks resubmission of the same UTR number.
 * Prevents double-payment fraud and replay attacks.
 */
const utrDeduplication = (req, res, next) => {
  const { utrNumber } = req.body;
  if (!utrNumber) return next(); // Let validator catch this

  // Already fully processed?
  if (processedUTRs.has(utrNumber)) {
    const record = processedUTRs.get(utrNumber);
    logger.warn('[PAYMENT-SEC] Duplicate UTR submission (already processed)', {
      utr: utrNumber, ip: req.ip, originalIp: record.ip
    });
    return res.status(409).json({
      success: false,
      message: 'This UTR number has already been processed.',
      error: { code: 'UTR_ALREADY_PROCESSED' }
    });
  }

  // Currently pending?
  if (pendingUTRs.has(utrNumber)) {
    const record = pendingUTRs.get(utrNumber);
    record.attempts++;
    if (record.attempts > 2) {
      logger.warn('[PAYMENT-SEC] Multiple submissions of same pending UTR', {
        utr: utrNumber, ip: req.ip, attempts: record.attempts
      });
    }
    return res.status(409).json({
      success: false,
      message: 'This UTR is already under review.',
      error: { code: 'UTR_PENDING' }
    });
  }

  // Mark as pending
  pendingUTRs.set(utrNumber, {
    submittedAt: Date.now(),
    ip: req.ip,
    attempts: 1
  });

  // Attach cleanup callbacks for use in controller
  req.markUTRProcessed = () => {
    processedUTRs.set(utrNumber, { processedAt: Date.now(), ip: req.ip });
    pendingUTRs.delete(utrNumber);
  };
  req.markUTRFailed = () => {
    pendingUTRs.delete(utrNumber);
  };

  next();
};

// ── Idempotency Key ───────────────────────────────────────────────

/**
 * Clients should send `Idempotency-Key: <uuid>` header on payment submit.
 * If same key sent twice, return cached response without reprocessing.
 */
const idempotencyCheck = (req, res, next) => {
  const key = req.headers['idempotency-key'];
  if (!key) return next(); // Optional — not enforced

  // Validate key format (UUID v4)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid Idempotency-Key format. Must be UUID v4.',
      error: { code: 'INVALID_IDEMPOTENCY_KEY' }
    });
  }

  if (idempotencyStore.has(key)) {
    const cached = idempotencyStore.get(key);
    logger.info('[PAYMENT-SEC] Returning cached idempotent response', { key, ip: req.ip });
    return res.status(cached.status).json(cached.body);
  }

  // Intercept response to cache it
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode < 500) {
      idempotencyStore.set(key, {
        status: res.statusCode,
        body,
        storedAt: Date.now()
      });
    }
    return originalJson(body);
  };

  next();
};

// ── Payment Payload Integrity ─────────────────────────────────────

/**
 * Validates that payment amount matches known prices.
 * Prevents price tampering (e.g., sending amount=1 for a ₹250 plan).
 */
const VALID_PAYMENT_AMOUNTS = {
  activation: parseInt(process.env.ACTIVATION_PRICE || '250', 10),
  extra_slot:  parseInt(process.env.EXTRA_SLOT_PRICE  || '100', 10),
};

const paymentIntegrityCheck = (req, res, next) => {
  const { paymentType, amount } = req.body;

  // If client sends amount, verify it matches server-side price
  if (amount !== undefined) {
    const expected = VALID_PAYMENT_AMOUNTS[paymentType];
    if (expected !== undefined && parseInt(amount, 10) !== expected) {
      logger.warn('[PAYMENT-SEC] Amount tampering detected', {
        ip: req.ip, sent: amount, expected, type: paymentType
      });
      return res.status(400).json({
        success: false,
        message: 'Invalid payment amount.',
        error: { code: 'AMOUNT_TAMPERED' }
      });
    }
  }

  next();
};

// ── Payment Fraud Fingerprint ─────────────────────────────────────

const fraudStore = new Map(); // fingerprint → { attempts, firstSeen }

/**
 * Tracks payment submissions per device fingerprint.
 * A single device submitting many different UTRs is suspicious.
 */
const fraudFingerprinting = (req, res, next) => {
  const fingerprint = req.fingerprint || req.ip;
  const now = Date.now();
  const WINDOW = 24 * 60 * 60 * 1000; // 24h
  const MAX_ATTEMPTS = 5;

  if (!fraudStore.has(fingerprint)) {
    fraudStore.set(fingerprint, { attempts: 0, firstSeen: now });
  }

  const record = fraudStore.get(fingerprint);

  // Reset window
  if (now - record.firstSeen > WINDOW) {
    record.attempts = 0;
    record.firstSeen = now;
  }

  record.attempts++;

  if (record.attempts > MAX_ATTEMPTS) {
    logger.warn('[PAYMENT-SEC] Fraud fingerprint blocked', {
      fingerprint, attempts: record.attempts, ip: req.ip
    });
    return res.status(429).json({
      success: false,
      message: 'Too many payment attempts. Contact support.',
      error: { code: 'PAYMENT_FRAUD_DETECTED' }
    });
  }

  next();
};

// ── UTR Format Hardening ──────────────────────────────────────────

/**
 * UTR numbers are exactly 12 digits in India (NEFT/IMPS/UPI).
 * Reject anything that doesn't match precisely.
 */
const utrFormatHardening = (req, res, next) => {
  const { utrNumber } = req.body;
  if (!utrNumber) return next();

  // Must be exactly 12 digits, no spaces, no letters
  if (!/^\d{12}$/.test(String(utrNumber).trim())) {
    return res.status(400).json({
      success: false,
      message: 'UTR must be exactly 12 digits.',
      error: { code: 'INVALID_UTR_FORMAT' }
    });
  }

  // Sanitize
  req.body.utrNumber = String(utrNumber).trim();
  next();
};

// ── Export ────────────────────────────────────────────────────────

module.exports = {
  utrDeduplication,
  idempotencyCheck,
  paymentIntegrityCheck,
  fraudFingerprinting,
  utrFormatHardening,

  // Compose: full payment security stack for /submit
  paymentSecurityStack: [
    utrFormatHardening,
    fraudFingerprinting,
    idempotencyCheck,
    paymentIntegrityCheck,
    utrDeduplication,
  ],
};
