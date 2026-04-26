const express = require('express');
const router = express.Router();
const requireAdmin = require('../middleware/requireAdmin');
const ctrl = require('../controllers/adminController');
const {
  adminBruteForceGuard,
  adminSessionBindingCheck,
  requireActionCode
} = require('../middleware/adminFortress');

// ─── Rate limiter specifically for admin routes ───────────────────
const rateLimit = require('express-rate-limit');
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  validate: { default: false },
  message: { success: false, message: 'Too many admin requests.', error: { code: 'ADMIN_RATE_LIMITED' } }
});
router.use(adminLimiter);

// ─── Auth (public — but brute-force guarded) ────────────────────
router.post('/login',
  adminBruteForceGuard,        // ← Lockout after 5 failures, 15 min block
  ctrl.adminLogin
);
router.post('/logout', requireAdmin, ctrl.adminLogout);
router.get('/verify', requireAdmin, ctrl.verifySession);

// ─── All routes below: requireAdmin + session binding ───────────
// Session binding ensures the token can only be used from the
// device fingerprint that created it (blocks token theft).
router.use(requireAdmin, adminSessionBindingCheck);

// Overview
router.get('/overview', ctrl.getOverview);

// Users — destructive actions require action codes
router.get('/users', ctrl.getUsers);
router.get('/users/:googleUid', ctrl.getUserDetail);
router.post('/users/:googleUid/block',      requireActionCode('BLOCK_USER'),   ctrl.blockUser);
router.post('/users/:googleUid/unblock',    requireActionCode('UNBLOCK_USER'), ctrl.unblockUser);
router.post('/users/:googleUid/force-reset',requireActionCode('FORCE_RESET'),  ctrl.forceResetUser);
router.post('/users/:googleUid/update-name', ctrl.updateUserName); // No action code as requested
router.delete('/users/:googleUid',          requireActionCode('DELETE_USER'),  ctrl.deleteUser);

// Payments
router.get('/payments', ctrl.getPayments);
router.get('/payments/stats', ctrl.getPaymentStats);
router.post('/payments/:id/approve', requireActionCode('APPROVE_PAYMENT'), ctrl.approvePayment);
router.post('/payments/:id/reject',  requireActionCode('REJECT_PAYMENT'),  ctrl.rejectPayment);
router.delete('/payments/:id',       requireActionCode('DELETE_PAYMENT'),  ctrl.deletePaymentRequest);

// Keys
router.get('/keys', ctrl.getKeys);
router.get('/keys/stats', ctrl.getKeyStats);
router.post('/keys/generate',     requireActionCode('GENERATE_KEYS'), ctrl.generateKeys);
router.delete('/keys/:id',        requireActionCode('DELETE_KEY'),    ctrl.deleteLicenseKey);

// Questions & Bulk
router.post('/questions/bulk-upload', ctrl.bulkUploadQuestions);
router.get('/teachers', ctrl.getTeachers);
router.get('/teachers/:uid/banks', ctrl.getTeacherBanks);
router.get('/storage-stats', ctrl.getStorageStats);

// Feedback
router.get('/feedback', ctrl.getFeedback);
router.post('/feedback/:id/mark-reviewed', requireActionCode('MARK_FEEDBACK'),   ctrl.markFeedbackReviewed);
router.delete('/feedback/:id',             requireActionCode('DELETE_FEEDBACK'),  ctrl.deleteFeedback);

// Banks
router.get('/banks', ctrl.getBanks);
router.post('/banks/:bankId/deactivate', requireActionCode('DEACTIVATE_BANK'), ctrl.deactivateBank);
router.delete('/banks/:bankId',          requireActionCode('DELETE_BANK'),      ctrl.deleteBank);

// Study Circles
router.get('/circles', ctrl.getStudyCircles);
router.delete('/circles/:id', ctrl.deleteStudyCircle);

// Analytics
router.get('/analytics', ctrl.getAnalytics);

// Settings — all require action codes
router.get('/settings', ctrl.getSettings);
router.post('/settings/maintenance', ctrl.toggleMaintenance); // Controller handles ON vs OFF code validation separately
router.post('/settings/announcement', ctrl.setAnnouncement);
router.delete('/settings/announcement', ctrl.removeAnnouncement);
router.post('/settings/update-key', requireActionCode('GENERATE_KEYS'),     ctrl.updateSystemKey);

// Logs
router.get('/logs', ctrl.getLogs);
router.delete('/logs', requireActionCode('CLEAR_LOGS'), ctrl.clearLogs);

// System
router.post('/restart', requireActionCode('RESTART_SERVER'), ctrl.restartServer);

// Activity
router.get('/activity', ctrl.getActivity);

// Blacklist
router.get('/blacklist', ctrl.getBlacklist);
router.post('/blacklist', ctrl.addToBlacklist);
router.delete('/blacklist', ctrl.removeFromBlacklist);

module.exports = router;
