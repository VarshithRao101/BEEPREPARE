const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireActivated = require('../middleware/requireActivated');
const aiController = require('../controllers/aiController');

const guard = [requireAuth, requireActivated];

// router.get('/sessions', ...guard, aiController.getSessions);
// router.get('/sessions/:sessionId', ...guard, aiController.getSessionMessages);
router.post('/chat', ...guard, aiController.sendMessage);
// router.delete('/sessions/:sessionId', ...guard, aiController.deleteSession);

module.exports = router;
