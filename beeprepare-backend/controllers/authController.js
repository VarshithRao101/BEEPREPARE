const { admin } = require('../config/firebase');
const User = require('../models/User');
const { success, error } = require('../utils/responseHelper');
const { logLogin } = require('../services/logService');

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
            { isActivated: true }
          );
          user.isActivated = true;
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
    console.error('CRITICAL LOGIN ERROR:',
      err.message, err.stack);
    return error(res,
      'Authentication failed',
      'AUTH_FAILED', 500
    );
  }
};

// POST /api/auth/set-role
const setRole = async (req, res) => {
  try {
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
      await User.updateOne({ googleUid: req.user.googleUid }, { role }, { upsert: true });
    } catch (dbErr) {
      throw dbErr;
    }

    return success(res, 'Role set successfully', {
      role,
      redirectTo: role === 'teacher' ? 'teacher-home' : 'student-home'
    });

  } catch (err) {
    console.error('setRole error:', err);
    return error(res, 'Failed to set role', 'SERVER_ERROR', 500);
  }
};

// POST /api/auth/logout
const logout = async (req, res) => {
  try {

    await admin.auth().revokeRefreshTokens(req.user.googleUid);
    return success(res, 'Logged out successfully', null);
  } catch (err) {
    console.error('logout error:', err);
    return error(res, 'Logout failed', 'SERVER_ERROR', 500);
  }
};

module.exports = { googleLogin, setRole, logout };
