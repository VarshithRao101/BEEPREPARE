const { admin } = require('../config/firebase');
const { connectDB } = require('../config/db');
const User = require('../models/User');
const Bank = require('../models/Bank');
const Question = require('../models/Question');
const Note = require('../models/Note');
const Bookmark = require('../models/Bookmark');
const Doubt = require('../models/Doubt');
const TestSession = require('../models/TestSession');
const Streak = require('../models/Streak');
const ActivityLog = require('../models/ActivityLog');
const AccessRequest = require('../models/AccessRequest');
const { success, error } = require('../utils/responseHelper');
const { logLogin } = require('../services/logService');
const Blacklist = require('../models/Blacklist');

// Helper: determine where to redirect user after login
const getRedirectTarget = (user) => {
  if (!user.isActivated) return 'activation';
  if (!user.role) return 'role-select';
  if (user.role === 'teacher')
    return 'teacher-home';
  if (user.role === 'student')
    return 'student-home';
  return 'activation';
};

// POST /api/auth/google-login
const googleLogin = async (req, res) => {
  try {
    await connectDB();
    const { idToken } = req.body;
    if (!idToken) {
      return error(res,
        'Firebase ID token is required',
        'MISSING_TOKEN', 400
      );
    }

    let decoded;
    try {
      decoded = await admin.auth()
        .verifyIdToken(idToken);
    } catch (tokenErr) {
      return error(res,
        'Invalid or expired Firebase token',
        'INVALID_TOKEN', 401
      );
    }

    const { uid, email, name, picture } = decoded;

    // --- BLACKLIST ENFORCEMENT ---
    const isBlacklisted = await Blacklist.findOne({ email: email.toLowerCase().trim() });
    if (isBlacklisted) {
      return error(res, 'Your account has been permanently restricted from BEEPREPARE.', 'ACCOUNT_BLACK_LISTED', 403);
    }

    let user;
    let isNewUser = false;

    try {
      // First, try to find by googleUid
      user = await User.findOne({ googleUid: uid });

      // If not found, try by email (in case Firebase UID changed or sync issue)
      if (!user) {
        user = await User.findOne({ email: email });
        if (user) {
          // Sync UID to existing email record
          await User.updateOne({ _id: user._id }, { googleUid: uid });
          user.googleUid = uid;
        }
      }

      if (!user) {
        isNewUser = true;
        user = await User.create({
          googleUid: uid,
          email: email,
          displayName: name || email.split('@')[0],
          photoUrl: picture || null,
          isActivated: false,
          role: null,
          planType: 'free',
          lastLoginAt: new Date()
        });
      } else {
        await User.updateOne(
          { _id: user._id },
          { lastLoginAt: new Date() }
        );
        if (user.licenseKey && !user.isActivated) {
          await User.updateOne(
            { _id: user._id },
            { 
              isActivated: true,
              planType: 'active',
              subjectLimit: 1
            }
          );
          user.isActivated = true;
          user.planType = 'active';
          user.subjectLimit = 1;
        }
      }

    } catch (dbErr) {
      console.error('MongoDB error:', dbErr.message);
      return error(res,
        'Database error during login',
        'DB_ERROR', 500
      );
    }

    try {
      const { logLogin } =
        require('../services/logService');
      logLogin(uid);
    } catch (fErr) {}

    return success(res, 'Login successful', {
      user: {
        googleUid: user.googleUid,
        email: user.email,
        displayName: user.displayName,
        photoUrl: user.photoUrl,
        role: user.role,
        isActivated: user.isActivated,
        planType: user.planType
      },
      isNewUser,
      redirectTo: getRedirectTarget(user)
    });

  } catch (err) {
    console.error('CRITICAL LOGIN ERROR:', err.message, err.stack);
    return error(res,
      'Authentication failed: ' + err.message,
      'AUTH_FAILED', 500
    );
  }
};

// POST /api/auth/set-role
const setRole = async (req, res) => {
  try {
    await connectDB();
    await connectDB();
    const { role } = req.body;

    if (!role || !['teacher', 'student'].includes(role)) {
      return error(res, "Role must be 'teacher' or 'student'", 'INVALID_ROLE', 400);
    }
    if (!req.user.isActivated) {
      return error(res, 'Please activate your license key first', 'NOT_ACTIVATED', 403);
    }
    if (req.user.role) {
      return error(res, 'Role has already been set and cannot be changed', 'ROLE_ALREADY_SET', 409);
    }

    try {
      const generateBeeId = (role) => {
        const chars = '0123456789';
        let num = '';
        for (let i = 0; i < 4; i++) {
          num += chars[Math.floor(
            Math.random() * chars.length)];
        }
        return role === 'teacher'
          ? `TEA-${num}`
          : `STU-${num}`;
      };

      // Generate unique BEE ID
      let beeId;
      let attempts = 0;
      do {
        beeId = generateBeeId(role);
        const exists = await User.findOne({ beeId });
        if (!exists) break;
        attempts++;
      } while (attempts < 10);

      await User.updateOne(
        { googleUid: req.user.googleUid },
        { role, beeId }
      );

      return success(res,
        'Role set successfully', {
        role,
        beeId,
        redirectTo: role === 'teacher'
          ? 'teacher-home'
          : 'student-home'
      });
    } catch (dbErr) {
      throw dbErr;
    }

  } catch (err) {
    console.error('setRole error:', err);
    return error(res, 'Failed to set role', 'SERVER_ERROR', 500);
  }
};

// POST /api/auth/logout
const logout = async (req, res) => {
  try {
    await connectDB();

    await admin.auth().revokeRefreshTokens(req.user.googleUid);
    return success(res, 'Logged out successfully', null);
  } catch (err) {
    console.error('logout error:', err);
    return error(res, 'Logout failed', 'SERVER_ERROR', 500);
  }
};

// POST /api/auth/wipe-data
const wipeData = async (req, res) => {
  try {
    await connectDB();
    const googleUid = req.user.googleUid;
    const user = await User.findOne({ googleUid });
    if (!user) return error(res, 'User not found', 'NOT_FOUND', 404);

    // Get all banks
    const banks = await Bank.find({ teacherId: googleUid });
    const bankIds = banks.map(b => b._id.toString());

    // Delete from Questions DB (Cluster 1)
    if (bankIds.length > 0) {
      await Question.deleteMany({
        bankId: { $in: bankIds }
      });
    }

    // Delete all main DB data (Cluster 2)
    await Promise.all([
      Bank.deleteMany({ teacherId: googleUid }),
      Note.deleteMany({ teacherId: googleUid }),
      AccessRequest.deleteMany({
        $or: [
          { studentId: googleUid },
          { teacherId: googleUid }
        ]
      }),
      Doubt.deleteMany({
        $or: [
          { studentId: googleUid },
          { teacherId: googleUid }
        ]
      }),
      TestSession.deleteMany({ studentId: googleUid }),
      Streak.deleteMany({ userId: googleUid }),
      Bookmark.deleteMany({ studentId: googleUid }),
      ActivityLog.deleteMany({ userId: googleUid })
    ]);

    // Reset user fields only (keep account, clear all data)
    await User.updateOne(
      { googleUid },
      {
        $set: {
          subjects: [],
          classes: [],
          totalQuestions: 0,
          activeStudents: 0,
          activeBanks: [],
          streak: {
            current: 0,
            best: 0,
            lastActive: null
          },
          stats: {
            testsTaken: 0,
            avgScore: 0
          }
        }
      }
    );

    return success(res, 'All account data has been sanitized successfully', null);
  } catch (err) {
    console.error('wipeData error:', err.message);
    return error(res, 'Failed to sanitize data hub', 'SERVER_ERROR', 500);
  }
};

const verifySession = async (req, res) => {
  await connectDB();
  return success(res, 'Session valid', {
    uid: req.user.googleUid,
    role: req.user.role,
    isActivated: req.user.isActivated
  });
};

module.exports = { googleLogin, setRole, logout, wipeData, verifySession };
