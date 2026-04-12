const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');

// All admin routes require admin role
router.use(requireAuth, requireRole('admin'));

router.delete('/notes/:noteId', adminController.deleteNote);
router.get('/stats/sync', adminController.syncStats);
router.get('/users', adminController.getUsers);
router.get('/keys/generate', adminController.generateKey);
router.post('/system/maintenance', require('../controllers/systemController').toggleMaintenance);

module.exports = router;
