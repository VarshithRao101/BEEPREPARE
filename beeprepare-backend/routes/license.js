const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const { verifyKey } = require('../controllers/licenseController');
const { activationLimiter } = require('../middleware/rateLimiters');
const { validateLicenseKey } = require('../middleware/validators');

/**
 * @route   POST /api/license/verify
 * @desc    Validate and activate a license key
 */
router.post('/verify', requireAuth, activationLimiter, validateLicenseKey, verifyKey);

module.exports = router;
