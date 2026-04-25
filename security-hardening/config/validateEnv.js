/**
 * BEEPREPARE — ENVIRONMENT VARIABLE VALIDATOR
 * Runs at server startup. If any required env var is missing or weak
 * in production, the server refuses to start.
 *
 * DROP THIS FILE in: beeprepare-backend/config/validateEnv.js
 * CALL IT in server.js as the VERY FIRST LINE after requires:
 *   require('./config/validateEnv')();
 */

'use strict';

const crypto = require('crypto');

const validateEnv = () => {
  const isProd = process.env.NODE_ENV === 'production';
  const errors = [];
  const warnings = [];

  // ── Required in all environments ────────────────────────────────
  const alwaysRequired = [
    'MONGODB_URI',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
    'ADMIN_JWT_SECRET',
    'RESEND_API_KEY',
    'GROQ_API_KEY',
    'GEMINI_API_KEY',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'PAYMENT_UPI_ID',
  ];

  for (const key of alwaysRequired) {
    if (!process.env[key]) {
      errors.push(`Missing required env var: ${key}`);
    }
  }

  // ── Required in production only ─────────────────────────────────
  const prodRequired = [
    'ENCRYPTION_SECRET',
    'LOOKUP_HMAC_SECRET',
    'ALLOWED_ORIGINS',
    // Action codes
    'CODE_BLOCK_USER',
    'CODE_UNBLOCK_USER',
    'CODE_DELETE_USER',
    'CODE_APPROVE_PAYMENT',
    'CODE_REJECT_PAYMENT',
    'CODE_GENERATE_KEYS',
    'CODE_MAINTENANCE_ON',
    'CODE_MAINTENANCE_OFF',
    'CODE_CLEAR_LOGS',
    'CODE_RESTART_SERVER',
    'CODE_CHANGE_ADMIN_PASS',
    'CODE_FORCE_RESET',
    'CODE_DELETE_KEY',
    'CODE_DELETE_PAYMENT',
  ];

  if (isProd) {
    for (const key of prodRequired) {
      if (!process.env[key]) {
        errors.push(`Missing required production env var: ${key}`);
      }
    }
  }

  // ── Strength checks ─────────────────────────────────────────────
  const strengthChecks = [
    {
      key: 'ADMIN_JWT_SECRET',
      minLen: 32,
      check: (v) => v.length >= 32,
      message: 'must be at least 32 characters'
    },
    {
      key: 'ENCRYPTION_SECRET',
      minLen: 32,
      check: (v) => v.length >= 32,
      message: 'must be at least 32 characters'
    },
    {
      key: 'LOOKUP_HMAC_SECRET',
      minLen: 32,
      check: (v) => v.length >= 32,
      message: 'must be at least 32 characters'
    },
  ];

  for (const { key, check, message } of strengthChecks) {
    const val = process.env[key];
    if (val && !check(val)) {
      if (isProd) {
        errors.push(`Weak secret: ${key} — ${message}`);
      } else {
        warnings.push(`Weak secret: ${key} — ${message} (will fail in production)`);
      }
    }
  }

  // ── Known-compromised values ────────────────────────────────────
  // These are the exact values that were leaked. Hard-block them from running.
  const knownCompromised = {
    ADMIN_JWT_SECRET: ['BeeAdminJWT#9x7K2619Delta'],
    // Add other known-compromised values here during rotation
  };

  for (const [key, badValues] of Object.entries(knownCompromised)) {
    const val = process.env[key];
    if (val && badValues.includes(val)) {
      errors.push(
        `SECURITY BREACH: ${key} is set to a known-compromised value! ` +
        `Rotate it immediately and never use this value again.`
      );
    }
  }

  // ── Action code uniqueness ───────────────────────────────────────
  const actionCodes = [
    'CODE_BLOCK_USER', 'CODE_UNBLOCK_USER', 'CODE_DELETE_USER',
    'CODE_APPROVE_PAYMENT', 'CODE_REJECT_PAYMENT', 'CODE_GENERATE_KEYS',
    'CODE_DELETE_FEEDBACK', 'CODE_DEACTIVATE_BANK', 'CODE_DELETE_BANK',
    'CODE_MAINTENANCE_ON', 'CODE_MAINTENANCE_OFF',
  ].map(k => process.env[k]).filter(Boolean);

  const uniqueCodes = new Set(actionCodes);
  if (isProd && uniqueCodes.size < actionCodes.length) {
    errors.push('Action codes must all be unique — duplicate codes detected!');
  }

  // Minimum length for action codes
  if (isProd) {
    for (const codeKey of [
      'CODE_BLOCK_USER', 'CODE_DELETE_USER', 'CODE_APPROVE_PAYMENT',
      'CODE_MAINTENANCE_ON', 'CODE_FORCE_RESET', 'CODE_RESTART_SERVER'
    ]) {
      const val = process.env[codeKey];
      if (val && val.length < 16) {
        errors.push(`Action code ${codeKey} must be at least 16 characters in production`);
      }
    }
  }

  // ── Firebase private key format ──────────────────────────────────
  const fbKey = process.env.FIREBASE_PRIVATE_KEY;
  if (fbKey && !fbKey.includes('-----BEGIN')) {
    warnings.push(
      'FIREBASE_PRIVATE_KEY does not look like a valid PEM key. ' +
      'Ensure newlines are escaped as \\n in the .env file.'
    );
  }

  // ── CORS in production ───────────────────────────────────────────
  if (isProd) {
    const origins = process.env.ALLOWED_ORIGINS || '';
    if (origins === '*' || origins.includes('*')) {
      errors.push('ALLOWED_ORIGINS cannot use wildcard (*) in production!');
    }
    if (!origins) {
      warnings.push('ALLOWED_ORIGINS not set — CORS will block all cross-origin requests');
    }
  }

  // ── NODE_ENV sanity ──────────────────────────────────────────────
  if (!['development', 'production', 'test'].includes(process.env.NODE_ENV)) {
    warnings.push(`Unknown NODE_ENV: "${process.env.NODE_ENV}" — defaulting to development`);
  }

  // ── Report ───────────────────────────────────────────────────────
  if (warnings.length > 0) {
    console.warn('\n⚠️  [ENV VALIDATOR] Warnings:');
    warnings.forEach(w => console.warn(`   • ${w}`));
    console.warn('');
  }

  if (errors.length > 0) {
    console.error('\n🚨 [ENV VALIDATOR] FATAL ERRORS — server cannot start:');
    errors.forEach(e => console.error(`   ✖ ${e}`));
    console.error('\nFix these issues before starting the server.\n');

    if (isProd) {
      process.exit(1);
    } else {
      console.warn('[ENV VALIDATOR] Continuing in development mode despite errors.\n');
    }
  } else {
    console.log('✅ [ENV VALIDATOR] All environment checks passed.');
  }
};

module.exports = validateEnv;
