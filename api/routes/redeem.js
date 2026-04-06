const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const { redeemKey } = require('../controllers/redeemController');
const { verificationLimiter } = require('../middleware/rateLimiters');

/**
 * @route   POST /api/redeem/code
 * @desc    Validate and redeem a product code (e.g. for extra subject slots)
 */
router.post('/code', requireAuth, verificationLimiter, redeemKey);

module.exports = router;
