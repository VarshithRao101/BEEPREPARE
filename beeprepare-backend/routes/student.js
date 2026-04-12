const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireActivated = require('../middleware/requireActivated');
const requireRole = require('../middleware/requireRole');
const studentController = require('../controllers/studentController');

const guard = [requireAuth, requireActivated, requireRole('student')];

// Profile + Dashboard
router.get('/dashboard',                    ...guard, studentController.getDashboard);
router.get('/profile',                      ...guard, studentController.getProfile);
router.put('/profile',                      ...guard, studentController.updateProfile);

// Banks — NOTE: specific paths before :bankId param routes
router.post('/banks/search',                ...guard, studentController.searchBank);
router.post('/banks/request',               ...guard, studentController.requestAccess);
router.post('/banks/verify-otp',            ...guard, studentController.verifyOTP);
router.get('/banks',                        ...guard, studentController.getMyBanks);
router.delete('/banks/:bankId',             ...guard, studentController.deleteBank);
router.get('/banks/:bankId/chapters',       ...guard, studentController.getBankChapters);

// Notes
router.get('/notes',                        ...guard, studentController.getNotes);

// Tests — specific before :sessionId
router.post('/tests/generate',              ...guard, studentController.generateTest);
router.get('/tests/history',               ...guard, studentController.getTestHistory);
router.post('/tests/:sessionId/submit',     ...guard, studentController.submitTest);

// Doubts
router.get('/doubts',                       ...guard, studentController.getDoubts);
router.post('/doubts',                      ...guard, studentController.submitDoubt);
router.get('/doubts/:id/messages',          ...guard, studentController.getDoubtMessages);
router.post('/doubts/:id/messages',         ...guard, studentController.sendDoubtMessage);

// Bookmarks
router.get('/bookmarks',                    ...guard, studentController.getBookmarks);
router.post('/bookmarks',                   ...guard, studentController.addBookmark);
router.delete('/bookmarks/:questionId',     ...guard, studentController.deleteBookmark);

// Streak
router.get('/streak',                       ...guard, studentController.getStreak);
router.post('/streak/activity',              ...guard, studentController.updateStreakActivity);

module.exports = router;
