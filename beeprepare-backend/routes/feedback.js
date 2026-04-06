const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const {
  upload,
  submitFeedback,
  getMyFeedback
} = require('../controllers/feedbackController');

router.post('/', requireAuth, upload.single('attachment'), submitFeedback);
router.get('/', requireAuth, getMyFeedback);

module.exports = router;
