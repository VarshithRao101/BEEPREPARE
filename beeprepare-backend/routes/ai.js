const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireActivated = require('../middleware/requireActivated');
const aiController = require('../controllers/aiController');
const { aiLimiter } = require('../middleware/rateLimiters');

const guard = [requireAuth, requireActivated];

// router.get('/sessions', ...guard, aiController.getSessions);
// router.get('/sessions/:sessionId', ...guard, aiController.getSessionMessages);
router.post('/chat', requireAuth, requireActivated, aiLimiter, aiController.academicAIHandler);
router.post('/support', requireAuth, requireActivated, aiLimiter, aiController.supportBotHandler);
// router.delete('/sessions/:sessionId', ...guard, aiController.deleteSession);

module.exports = router;
