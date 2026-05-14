const express = require('express');
const router = express.Router();
const leaderboardController = require('../controllers/leaderboardController');
const { requireAuth } = require('../middleware/auth');

// GLOBAL (Student POV)
router.get('/global', requireAuth, leaderboardController.getGlobalLeaderboard);

// TEACHER (Teacher POV - Filtered to their students)
router.get('/teacher', requireAuth, leaderboardController.getTeacherLeaderboard);

// ADMIN: Trigger Manual Snapshot (Secret or Admin token)
router.post('/snapshot', requireAuth, leaderboardController.generateSnapshots);

// ADMIN: Modify Stats
router.post('/modify', requireAuth, leaderboardController.adminModifyStats);

module.exports = router;
