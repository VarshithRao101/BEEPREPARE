const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const { redeemCode } = require('../controllers/redeemController');
const { activationLimiter } = require('../middleware/rateLimiters');

/**
 * @route   POST /api/redeem/code
 * @desc    Validate and redeem a product code (e.g. for extra subject slots)
 */
router.post('/code', requireAuth, activationLimiter, redeemCode);

module.exports = router;
