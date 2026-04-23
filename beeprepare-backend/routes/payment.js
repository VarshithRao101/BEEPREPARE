const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/paymentController');
const { validatePaymentSubmit } = require('../middleware/validators');

router.use(express.json());

// Public payment endpoints
router.post('/submit', validatePaymentSubmit, ctrl.submitPayment);
router.get('/status/:utrNumber', ctrl.checkPaymentStatus);
router.get('/config', ctrl.getPaymentConfig);
router.post('/resend/:utrNumber', ctrl.resendApprovalEmail);

module.exports = router;
