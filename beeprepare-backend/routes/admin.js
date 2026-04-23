const express = require('express');
const router = express.Router();
const requireAdmin =
  require('../middleware/requireAdmin');
const ctrl = require('../controllers/adminController');

// Auth (public)
router.post('/login', ctrl.adminLogin);
router.post('/logout', requireAdmin,
  ctrl.adminLogout);
router.get('/verify', requireAdmin,
  ctrl.verifySession);

// Overview
router.get('/overview', requireAdmin,
  ctrl.getOverview);

// Users
router.get('/users', requireAdmin,
  ctrl.getUsers);
router.get('/users/:googleUid', requireAdmin,
  ctrl.getUserDetail);
router.post('/users/:googleUid/block',
  requireAdmin, ctrl.blockUser);
router.post('/users/:googleUid/unblock',
  requireAdmin, ctrl.unblockUser);
router.post('/users/:googleUid/force-reset',
  requireAdmin, ctrl.forceResetUser);
router.delete('/users/:googleUid',
  requireAdmin, ctrl.deleteUser);

// Payments
router.get('/payments', requireAdmin,
  ctrl.getPayments);
router.get('/payments/stats', requireAdmin,
  ctrl.getPaymentStats);
router.post('/payments/:id/approve',
  requireAdmin, ctrl.approvePayment);
router.post('/payments/:id/reject',
  requireAdmin, ctrl.rejectPayment);
router.delete('/payments/:id', requireAdmin, ctrl.deletePaymentRequest);

// Keys
router.get('/keys', requireAdmin, ctrl.getKeys);
router.get('/keys/stats', requireAdmin, ctrl.getKeyStats);
router.post('/keys/generate', requireAdmin, ctrl.generateKeys);
router.delete('/keys/:id', requireAdmin, ctrl.deleteLicenseKey);

// Questions & Bulk Upload
router.post('/questions/bulk-upload', requireAdmin, ctrl.bulkUploadQuestions);
router.get('/teachers', requireAdmin, ctrl.getTeachers);
router.get('/teachers/:uid/banks', requireAdmin, ctrl.getTeacherBanks);

router.get('/storage-stats', requireAdmin, ctrl.getStorageStats);

// Feedback
router.get('/feedback', requireAdmin,
  ctrl.getFeedback);
router.post('/feedback/:id/mark-reviewed',
  requireAdmin, ctrl.markFeedbackReviewed);
router.delete('/feedback/:id', requireAdmin,
  ctrl.deleteFeedback);

// Banks
router.get('/banks', requireAdmin,
  ctrl.getBanks);
router.post('/banks/:bankId/deactivate',
  requireAdmin, ctrl.deactivateBank);
router.delete('/banks/:bankId', requireAdmin,
  ctrl.deleteBank);

// Study Circles
router.get('/circles', requireAdmin, ctrl.getStudyCircles);
router.delete('/circles/:id', requireAdmin, ctrl.deleteStudyCircle);

// Analytics
router.get('/analytics', requireAdmin,
  ctrl.getAnalytics);

// Settings
router.get('/settings', requireAdmin,
  ctrl.getSettings);
router.post('/settings/maintenance',
  requireAdmin, ctrl.toggleMaintenance);
router.post('/settings/announcement',
  requireAdmin, ctrl.setAnnouncement);
router.delete('/settings/announcement',
  requireAdmin, ctrl.removeAnnouncement);
router.post('/settings/update-key',
  requireAdmin, ctrl.updateSystemKey);

// Logs
router.get('/logs', requireAdmin,
  ctrl.getLogs);
router.delete('/logs', requireAdmin,
  ctrl.clearLogs);

// System
router.post('/restart', requireAdmin, ctrl.restartServer);

// Activity
router.get('/activity', requireAdmin, ctrl.getActivity);

// Blacklist
router.get('/blacklist', requireAdmin, ctrl.getBlacklist);
router.post('/blacklist', requireAdmin, ctrl.addToBlacklist);
router.delete('/blacklist', requireAdmin, ctrl.removeFromBlacklist);

module.exports = router;
