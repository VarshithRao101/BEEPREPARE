const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const { verifyKey } = require('../controllers/licenseController');
const { verificationLimiter } = require('../middleware/rateLimiters');

/**
 * @route   POST /api/license/verify
 * @desc    Validate and activate a license key
 */
router.post('/verify', requireAuth, verificationLimiter, verifyKey);

module.exports = router;
