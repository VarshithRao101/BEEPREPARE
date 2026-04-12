const express = require('express');
const router = express.Router();
const { getMaintenanceStatus } = require('../controllers/systemController');

/**
 * @route   GET /api/system/maintenance
 * @desc    Check if the system is in maintenance mode
 * @access  Public
 */
router.get('/maintenance', getMaintenanceStatus);

module.exports = router;
