const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/paymentController');
const { validatePaymentSubmit } = require('../middleware/validators');
const optionalAuth = require('../middleware/optionalAuth');
const {
  paymentSecurityStack,
  utrFormatHardening
} = require('../middleware/paymentSecurity');
const { paymentLimiter } = require('../middleware/rateLimiters');

router.use(express.json());

// POST /api/payment/submit
router.post('/submit',
  paymentLimiter,
  paymentSecurityStack,
  validatePaymentSubmit,
  ctrl.submitPayment
);

// GET /api/payment/status/:utrNumber
router.get('/status/:utrNumber',
  optionalAuth,
  utrFormatHardening,
  ctrl.checkPaymentStatus
);

// GET /api/payment/config
router.get('/config', ctrl.getPaymentConfig);

// POST /api/payment/resend/:utrNumber
router.post('/resend/:utrNumber',
  optionalAuth,
  utrFormatHardening,
  ctrl.resendApprovalEmail
);

module.exports = router;
