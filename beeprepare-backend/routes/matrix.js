const express = require('express');
const router  = express.Router();
const requireAuth = require('../middleware/requireAuth');
const ctrl = require('../controllers/matrixController');

// Helper for admin check (assuming there's a middleware or role in req.user)
const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') return next();
    return res.status(403).json({ success: false, message: 'Admin access required' });
};

router.use(requireAuth);

router.post('/generate',      ctrl.generatePaperCtrl);
router.get('/presets',        ctrl.getPresets);
router.post('/reload',        requireAdmin, ctrl.reloadEngine);
router.get('/status',         ctrl.getStatus);
router.post('/validate-dist', ctrl.validateDistribution);

module.exports = router;
