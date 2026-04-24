const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const { googleLogin, setRole, logout, wipeData, verifySession } = require('../controllers/authController');
const { validateGoogleLogin, validateSetRole } = require('../middleware/validators');

/**
 * @route   POST /api/auth/google-login
 * @desc    Authenticate with Firebase ID Token
 * @access  Public
 */
router.post('/google-login', validateGoogleLogin, googleLogin);

/**
 * @route   POST /api/auth/set-role
 * @desc    Initialize user role after first activation
 * @access  Protected
 */
router.post('/set-role', requireAuth, validateSetRole, setRole);

/**
 * @route   POST /api/auth/wipe-data
 * @desc    Permanently erase all user metadata and academic records
 * @access  Protected
 */
router.post('/wipe-data', requireAuth, wipeData);

router.get('/verify-session', requireAuth, verifySession);
router.post('/logout', requireAuth, logout);

module.exports = router;
