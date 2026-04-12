const express = require('express');
const router = express.Router();
const quoteController = require('../controllers/quoteController');
const requireAuth = require('../middleware/requireAuth');

// Protected routes (require login)
router.get('/all', requireAuth, quoteController.getAllQuotes);
router.get('/today', requireAuth, quoteController.getTodayQuote);

module.exports = router;
