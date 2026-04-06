const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireActivated = require('../middleware/requireActivated');
const aiController = require('../controllers/aiController');

const guard = [requireAuth, requireActivated];

router.post('/chat', ...guard, aiController.sendMessage);

module.exports = router;
