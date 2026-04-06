const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const { googleLogin, setRole, logout } = require('../controllers/authController');

/**
 * @route   POST /api/auth/google-login
 * @desc    Authenticate with Firebase ID Token
 * @access  Public
 */
router.post('/google-login', googleLogin);

/**
 * @route   POST /api/auth/set-role
 * @desc    Initialize user role after first activation
 * @access  Protected
 */
router.post('/set-role', requireAuth, setRole);

/**
 * @route   POST /api/auth/logout
 * @desc    Revoke Firebase refresh tokens
 * @access  Protected
 */
router.post('/logout', requireAuth, logout);

module.exports = router;
