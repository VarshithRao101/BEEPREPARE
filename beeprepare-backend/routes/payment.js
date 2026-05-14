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
// Public route - students check this without an account
router.get('/status/:utrNumber',
  utrFormatHardening,          // ← validate UTR format
  ctrl.checkPaymentStatus
);

// GET /api/payment/config — public OK
router.get('/config', ctrl.getPaymentConfig);

// POST /api/payment/resend/:utrNumber
// Public route
router.post('/resend/:utrNumber',
  utrFormatHardening,
  ctrl.resendApprovalEmail
);

module.exports = router;
