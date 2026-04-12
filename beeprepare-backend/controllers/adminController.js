const { db } = require('../config/firebase');
const { cloudinary } = require('../utils/cloudinaryHelper');
const User = require('../models/User');
const Bank = require('../models/Bank');
const Note = require('../models/Note');
const Question = require('../models/Question');
const AccessRequest = require('../models/AccessRequest');
const { success, error } = require('../utils/responseHelper');

// ══════════════════════════════════════════════════════════════════════════════
// 1. DELETE /api/admin/notes/:noteId
// ══════════════════════════════════════════════════════════════════════════════
const deleteNote = async (req, res) => {
  try {
    const { noteId } = req.params;
    const note = await Note.findById(noteId);
    if (!note) return error(res, 'Note not found', 'NOT_FOUND', 404);

    // 1. Delete from Cloudinary (Reliable method using Public ID)
    if (note.public_id) {
      try {
        await cloudinary.uploader.destroy(note.public_id, { resource_type: 'raw' });
        console.log(`Cloudinary asset deleted: ${note.public_id}`);
      } catch (err) {
        console.warn('Cloudinary cleanup failed but continuing:', err.message);
      }
    }

    // 2. Remove from MongoDB
    await Note.findByIdAndDelete(noteId);

    // 3. Decrement bank counter
    await Bank.updateOne({ _id: note.bankId }, { $inc: { notesCount: -1 } });

    return success(res, 'Note deleted successfully from Vault');
  } catch (err) {
    console.error('deleteNote error:', err);
    return error(res, 'Cleanup failed', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 2. GET /api/admin/stats/sync
// ══════════════════════════════════════════════════════════════════════════════
const syncStats = async (req, res) => {
  try {
    const users = await User.find({ role: 'teacher' });
    const results = [];

    for (const user of users) {
      const banks = await Bank.find({ teacherId: user.googleUid });
      const totalQuestions = await Question.countDocuments({ createdBy: user.googleUid });
      const activeStudents = await AccessRequest.countDocuments({ 
        teacherId: user.googleUid, 
        status: 'active' 
      });

      await User.updateOne(
        { googleUid: user.googleUid },
        { totalQuestions, activeStudents }
      );
      
      results.push({ email: user.email, totalQuestions, activeStudents });
    }

    return success(res, 'Stats synchronized', results);
  } catch (err) {
    return error(res, 'Sync failed', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 3. GET /api/admin/users
// ══════════════════════════════════════════════════════════════════════════════
const getUsers = async (req, res) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    return success(res, 'Users fetched successfully', users);
  } catch (err) {
    return error(res, 'Failed to fetch users', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 4. GET /api/admin/keys/generate
// ══════════════════════════════════════════════════════════════════════════════
const generateKey = async (req, res) => {
  try {
    const { plan = 'premium', subjectLimit = 3 } = req.query;
    const key = `BEE-${Math.random().toString(36).substr(2, 4).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    
    await db.collection('activation_keys').doc(key).set({
      key,
      plan,
      subjectLimit: parseInt(subjectLimit),
      isUsed: false,
      createdAt: new Date()
    });

    return success(res, 'New activation key generated', { key, plan, subjectLimit });
  } catch (err) {
    return error(res, 'Generation failed', 'SERVER_ERROR', 500);
  }
};

module.exports = {
  deleteNote,
  syncStats,
  getUsers,
  generateKey
};
