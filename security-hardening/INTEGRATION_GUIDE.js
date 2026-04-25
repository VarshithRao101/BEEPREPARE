/**
 * BEEPREPARE — server.js SECURITY PATCH
 * =====================================================================
 * This file shows EXACTLY where and how to integrate all new security
 * modules into your existing server.js.
 *
 * DO NOT replace your server.js with this file.
 * Instead, apply each marked change (▶ ADD / ▶ REPLACE / ▶ INSERT AFTER)
 * to your existing beeprepare-backend/server.js.
 * =====================================================================
 */

// ─────────────────────────────────────────────────────────────────
// ▶ ADD at the top, with your existing requires:
// ─────────────────────────────────────────────────────────────────

const { fortressStack } = require('./middleware/fortress');
const { csrfTokenEndpoint } = require('./middleware/csrf');
// paymentSecurity is applied in routes/payment.js — see below
// adminFortress is applied in routes/admin.js — see below


// ─────────────────────────────────────────────────────────────────
// ▶ INSERT AFTER: app.set('trust proxy', 1);
//   (Before all other middleware — fortress must be first)
// ─────────────────────────────────────────────────────────────────

// === FORTRESS SECURITY STACK (runs before everything) ===
app.use(fortressStack);


// ─────────────────────────────────────────────────────────────────
// ▶ ADD: CSRF token endpoint (before routes, after auth middleware)
// ─────────────────────────────────────────────────────────────────

// CSRF token generator — called by admin panel before state-changing requests
app.get('/api/csrf-token', requireAuth, csrfTokenEndpoint);
// Admin CSRF token — called without user auth (admin uses Firebase login)
app.get('/api/admin-csrf-token', csrfTokenEndpoint);


// ─────────────────────────────────────────────────────────────────
// ▶ REPLACE your existing /api/payment route registration:
// ─────────────────────────────────────────────────────────────────

// BEFORE (your current code):
// app.use('/api/payment', paymentLimiter, require('./routes/payment'));

// AFTER (replace with this):
app.use('/api/payment', paymentLimiter, require('./routes/payment'));
// NOTE: The payment security middleware is now applied INSIDE routes/payment.js
// See the updated routes/payment.js below.


// ─────────────────────────────────────────────────────────────────
// ▶ ADD: New environment variable to .env
// ─────────────────────────────────────────────────────────────────
/*
  Add these to your .env file:

  # Field-level encryption key (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  ENCRYPTION_SECRET=<64-char-hex-string>

  # HMAC secret for searchable hashes (generate similarly)
  LOOKUP_HMAC_SECRET=<64-char-hex-string>
*/


// ─────────────────────────────────────────────────────────────────
// ▶ UPDATED: routes/payment.js  (replace the full file)
// ─────────────────────────────────────────────────────────────────
/*
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/paymentController');
const { validatePaymentSubmit } = require('../middleware/validators');
const { paymentSecurityStack } = require('../middleware/paymentSecurity');
const requireAuth = require('../middleware/requireAuth');

router.use(express.json());

// Public payment endpoints — with full security stack
router.post('/submit',
  paymentSecurityStack,        // UTR dedup, fraud fingerprint, idempotency, integrity
  validatePaymentSubmit,       // Input validation
  ctrl.submitPayment
);

router.get('/status/:utrNumber',
  requireAuth,                 // ← SECURE THIS — was public before
  ctrl.checkPaymentStatus
);

router.get('/config', ctrl.getPaymentConfig);  // OK to be public (no sensitive data)

router.post('/resend/:utrNumber',
  requireAuth,                 // ← SECURE THIS — was public before
  ctrl.resendApprovalEmail
);

module.exports = router;
*/


// ─────────────────────────────────────────────────────────────────
// ▶ UPDATED: routes/admin.js — add brute-force + session binding
// ─────────────────────────────────────────────────────────────────
/*
  In routes/admin.js, import and add these to your login route:

  const { adminBruteForceGuard, adminSessionBindingCheck, requireActionCode, bindSession } =
    require('../middleware/adminFortress');

  // On your admin login POST route:
  router.post('/login',
    adminBruteForceGuard,      // Check lockout BEFORE credentials
    validateAdminLogin,
    async (req, res) => {
      const { id, password, captchaToken } = req.body;
      try {
        const admin = await verifyAdminCredentials(id, password);
        if (!admin) {
          req.recordFailedLogin();  // Increment brute-force counter
          return error(res, 'Invalid credentials.', 'INVALID_CREDS', 401);
        }
        req.recordSuccessfulLogin(); // Clear brute-force counter
        const token = generateAdminToken(admin.id);

        // Bind session to device fingerprint
        bindSession(admin.id, req.ip, req.headers['user-agent'], req.fingerprint);

        return res.json({ success: true, data: { token } });
      } catch (err) {
        req.recordFailedLogin();
        return error(res, 'Login failed.', 'LOGIN_ERROR', 500);
      }
    }
  );

  // On ALL protected admin routes, add session binding check:
  router.use(requireAdmin, adminSessionBindingCheck);

  // On destructive routes, add action code verification:
  router.post('/block-user',   requireAdmin, adminSessionBindingCheck, requireActionCode('BLOCK_USER'),   ctrl.blockUser);
  router.delete('/user/:id',   requireAdmin, adminSessionBindingCheck, requireActionCode('DELETE_USER'),  ctrl.deleteUser);
  router.post('/approve-payment', requireAdmin, adminSessionBindingCheck, requireActionCode('APPROVE_PAYMENT'), ctrl.approvePayment);
  // etc.
*/


// ─────────────────────────────────────────────────────────────────
// ▶ VALIDATION: config/validateEnv.js — add new required vars
// ─────────────────────────────────────────────────────────────────
/*
  Add to your existing validateEnv() function:

  const required = [
    // ... your existing ones ...
    'ENCRYPTION_SECRET',
    'LOOKUP_HMAC_SECRET',
  ];

  Also add a strength check:
  if (process.env.ENCRYPTION_SECRET?.length < 32) {
    throw new Error('ENCRYPTION_SECRET must be at least 32 characters');
  }
*/
