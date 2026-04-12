const multer = require('multer');
const { bucket } = require('../config/firebase');
const Feedback = require('../models/Feedback');
const { success, error } = require('../utils/responseHelper');

// ─── Multer Setup (memory storage — buffer uploaded to Firebase) ───────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB hard cap
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF, JPG, JPEG, PNG files are allowed'), false);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 1. POST /api/feedback
// ══════════════════════════════════════════════════════════════════════════════
const submitFeedback = async (req, res) => {
  try {
    const { feedbackType, message, rating } = req.body;
    const userId = req.user.googleUid;
    const context = req.user.role === 'teacher' ? 'Teacher' : 'Student';

    // Validate feedbackType
    const validTypes = ['bug', 'feature', 'rating', 'content'];
    if (!feedbackType || !validTypes.includes(feedbackType)) {
      return error(res, `feedbackType must be one of: ${validTypes.join(', ')}`, 'INVALID_TYPE', 400);
    }

    // Must provide either message or rating
    if ((!message || message.trim() === '') && !rating) {
      return error(res, 'You must provide either a message or a rating', 'MISSING_DATA', 400);
    }

    // Validate rating
    let parsedRating = parseInt(rating);
    if (rating !== undefined) {
      if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        return error(res, 'rating must be an integer between 1 and 5', 'INVALID_RATING', 400);
      }
    } else {
      parsedRating = 0;
    }

    // Validate message
    let parsedMessage = message ? message.trim() : null;
    if (parsedMessage && parsedMessage.length < 10) {
      return error(res, 'message must be at least 10 characters', 'TOO_SHORT', 400);
    }

    // Handle file upload if present
    let attachmentUrl = null;
    if (req.file) {
      // Validate type again
      const allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!allowedMime.includes(req.file.mimetype)) {
        return error(res, 'Only PDF, JPG, JPEG, PNG files are accepted', 'INVALID_FILE_TYPE', 400);
      }
      
      const extMap = {
        'application/pdf': 'pdf',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png'
      };
      const ext = extMap[req.file.mimetype];
      const fileName = `attachment_${Date.now()}.${ext}`;
      const feedbackTempId = Date.now().toString(); // temporary folder name since doc ID is unknown
      const storagePath = `feedback_attachments/${userId}/${feedbackTempId}/${fileName}`;

      const fileRef = bucket.file(storagePath);
      await fileRef.save(req.file.buffer, {
        metadata: { contentType: req.file.mimetype }
      });

      await fileRef.makePublic();
      attachmentUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    }

    // Save to DB
    const feedback = await Feedback.create({
      userId,
      context,
      feedbackType,
      message: parsedMessage,
      rating: parsedRating,
      attachmentUrl,
      status: 'pending_review'
    });

    return success(res, 'Thank you for your feedback!', { feedbackId: feedback._id }, 201);
  } catch (err) {
    console.error('submitFeedback error:', err);
    return error(res, 'Failed to submit feedback', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 2. GET /api/feedback
// ══════════════════════════════════════════════════════════════════════════════
const getMyFeedback = async (req, res) => {
  try {
    const userId = req.user.googleUid;
    const items = await Feedback.find({ userId }).sort({ createdAt: -1 });

    return success(res, 'Feedback history fetched', {
      feedbacks: items.map(f => ({
        feedbackId: f._id,
        feedbackType: f.feedbackType,
        messagePreview: f.message ? f.message.substring(0, 100) : null,
        rating: f.rating,
        status: f.status,
        submittedAt: f.createdAt
      }))
    });
  } catch (err) {
    console.error('getMyFeedback error:', err);
    return error(res, 'Failed to fetch feedback history', 'SERVER_ERROR', 500);
  }
};

module.exports = {
  upload,
  submitFeedback,
  getMyFeedback
};
