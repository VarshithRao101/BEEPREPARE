const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/paymentController');
const { validatePaymentSubmit } = require('../middleware/validators');
const requireAuth = require('../middleware/requireAuth');
const {
  paymentSecurityStack,
  utrFormatHardening
} = require('../middleware/paymentSecurity');

router.use(express.json());

// POST /api/payment/submit
// Full security stack: UTR format → fraud fingerprint → idempotency → price integrity → UTR dedup → validation → controller
router.post('/submit',
  paymentSecurityStack,        // ← UTR dedup, fraud fingerprint, idempotency, price tamper check
  validatePaymentSubmit,       // ← existing input validation
  ctrl.submitPayment
);

// GET /api/payment/status/:utrNumber
// Was public — now requires auth to prevent data harvesting
router.get('/status/:utrNumber',
  requireAuth,                 // ← SECURED: was completely public
  utrFormatHardening,          // ← validate UTR format even in GET
  ctrl.checkPaymentStatus
);

// GET /api/payment/config — public OK (no sensitive data, just UPI info)
router.get('/config', ctrl.getPaymentConfig);

// POST /api/payment/resend/:utrNumber
// Was public — now requires auth
router.post('/resend/:utrNumber',
  requireAuth,                 // ← SECURED: was completely public
  utrFormatHardening,
  ctrl.resendApprovalEmail
);

module.exports = router;
