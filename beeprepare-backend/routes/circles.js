const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireActivated = require('../middleware/requireActivated');
const ctrl = require('../controllers/circleController');

const guard = [requireAuth, requireActivated];

router.post('/create', ...guard, ctrl.createCircle);
router.post('/join', ...guard, ctrl.requestToJoin);
router.get('/my', ...guard, ctrl.getMyCircles);
router.get('/:circleId/messages', ...guard, ctrl.getMessages);
router.post('/:circleId/messages', ...guard, ctrl.sendMessage);
router.post('/:circleId/leave', ...guard, ctrl.leaveCircle);
router.delete('/:circleId', ...guard, ctrl.dissolveCircle);

// New approval routes
router.get('/:circleId/requests', ...guard, ctrl.getJoinRequests);
router.post('/:circleId/approve/:userId', ...guard, ctrl.approveJoinRequest);
router.post('/:circleId/reject/:userId', ...guard, ctrl.rejectJoinRequest);
router.post('/:circleId/kick/:userId', ...guard, ctrl.removeMember);
router.delete('/:circleId/messages/:messageId', ...guard, ctrl.deleteMessage);
router.post('/:circleId/rules', ...guard, ctrl.updateRules);

module.exports = router;
