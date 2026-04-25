const User = require('../models/User');
const LicenseKey = require('../models/LicenseKey');
const Bank = require('../models/Bank');
const Question = require('../models/Question');
const Note = require('../models/Note');
const Doubt = require('../models/Doubt');
const Feedback = require('../models/Feedback');
const ActivityLog = require('../models/ActivityLog');
const TestSession = require('../models/TestSession');
const AppSettings = require('../models/AppSettings');
const Announcement = require('../models/Announcement');
const PaymentRequest = require('../models/PaymentRequest');
const AdminSession = require('../models/AdminSession');
const Blacklist = require('../models/Blacklist');
const Streak = require('../models/Streak');
const Bookmark = require('../models/Bookmark');
const AccessRequest = require('../models/AccessRequest');
const StudyCircle = require('../models/StudyCircle');
const SystemConfig = require('../models/SystemConfig');
const { db } = require('../config/firebase');
const fs = require('fs');
const path = require('path');
const {
  verifyAdminCredentials,
  generateAdminToken,
  verifyActionCode
} = require('../utils/adminAuth');
const { bindSession } = require('../middleware/adminFortress');
const {
  sendPaymentApproved,
  sendPaymentRejected
} = require('../utils/emailService');
const { success, error } =
  require('../utils/responseHelper');

const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// ============ AUTH ============

// Note: Brute-force protection is handled by adminBruteForceGuard middleware in routes/admin.js

const adminLogin = async (req, res) => {
  try {
    const { adminId, password, captcha, captchaToken } = req.body;
    const ip = req.ip;

    if (!adminId || !password) {
      return error(res,
        'Admin ID and password required',
        'MISSING_CREDENTIALS', 400);
    }

    // 1. CAPTCHA Verification
    if (!captcha || !captchaToken) {
        return error(res, 'Security challenge incomplete', 'CAPTCHA_REQUIRED', 400);
    }

    const [tokenPart, expectedSum, expiry] = captchaToken.split(':');
    const crypto = require('crypto');
    const verifyToken = crypto.createHmac('sha256', process.env.ADMIN_JWT_SECRET)
        .update(`${expectedSum}-${expiry}`)
        .digest('hex');

    if (tokenPart !== verifyToken || Date.now() > parseInt(expiry) || parseInt(captcha) !== parseInt(expectedSum)) {
        return error(res, 'Security challenge failed or expired', 'INVALID_CAPTCHA', 403);
    }

    // 2. Authentication Logic
    const { verifyAdminCredentials, generateAdminToken } = require('../utils/adminAuth');
    const authResult = await verifyAdminCredentials(adminId.trim(), password.trim());

    if (!authResult) {
      // Failed attempts are now recorded by the 'adminBruteForceGuard' middleware via req.recordFailedLogin()
      return error(res, 'Invalid admin credentials', 'INVALID_CREDENTIALS', 401);
    }

    const tokenJwt = generateAdminToken(authResult.id);

    // Register session in DB for revocation tracking
    await AdminSession.create({
      adminId: authResult.id,
      token: tokenJwt,
      ip,
      userAgent: req.headers['user-agent'] || 'unknown',
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) // 8h
    });

    // Bind session to device fingerprint for hijack detection
    bindSession(authResult.id, ip, req.headers['user-agent'], req.fingerprint);

    // Log Activity
    try {
        await ActivityLog.create({
            adminId: authResult.id,
            action: 'ADMIN_LOGIN',
            target: 'SYSTEM',
            details: `Login successful via ${authResult.type} credentials`,
            ip,
            userAgent: req.headers['user-agent'] || 'unknown'
        });
    } catch (logErr) {
        console.warn('Login logging failed:', logErr.message);
    }

    return success(res, 'Login successful', {
      token: tokenJwt,
      adminId: authResult.id,
      expiresIn: '8h'
    });

  } catch (err) {
    console.error('adminLogin error:',
      err.message, err.stack);
    return error(res,
      'Login failed.',
      'SERVER_ERROR', 500);
  }
};

const adminLogout = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.includes('Bearer ')) {
    return success(res, 'Logged out');
  }
  const token = authHeader.split('Bearer ')[1];
  await AdminSession.findOneAndUpdate({ token }, { isRevoked: true });
  return success(res, 'Logged out successfully');
};

const verifySession = async (req, res) => {
  return success(res, 'Session valid', { admin: req.admin });
};

// ============ OVERVIEW ============

const getDbHealth = async () => {
  const { getMainConn, getQuestionsConn } = require('../config/db');
  const mainConn = getMainConn();
  const questionsConn = getQuestionsConn();

  return {
    mainDb: {
      status: mainConn.readyState === 1 ? 'connected' : 'disconnected',
      cluster: 'Cluster 2 (App State)',
      readyState: mainConn.readyState
    },
    questionsDb: {
      status: questionsConn.readyState === 1 ? 'connected' : 'disconnected',
      cluster: 'Cluster 1 (Academic)',
      readyState: questionsConn.readyState
    }
  };
};

const getOverview = async (req, res) => {
  try {
    const [
      totalUsers,
      totalTeachers,
      totalStudents,
      incompleteUsers,
      totalBanks,
      totalQuestions,
      totalTestsGenerated,
      pendingPayments,
      approvedPayments,
      recentSignups,
      maintSetting,
      announcement,
      dbHealth
    ] = await Promise.all([
      User.countDocuments({
        isActivated: true,
        role: { $in: ['teacher', 'student'] }
      }),
      User.countDocuments({
        isActivated: true,
        role: 'teacher'
      }),
      User.countDocuments({
        isActivated: true,
        role: 'student'
      }),
      User.countDocuments({
        $or: [
          { isActivated: false },
          { role: null }
        ]
      }),
      Bank.countDocuments(),
      Question.countDocuments(),
      TestSession.countDocuments(),
      PaymentRequest.countDocuments({ status: 'pending' }),
      PaymentRequest.find({ status: 'approved' }).lean(),
      User.find().sort({ createdAt: -1 }).limit(10).select('email displayName role createdAt').lean(),
      AppSettings.findOne({ key: 'maintenance_mode' }).lean(),
      Announcement.findOne({ isActive: true }).sort({ createdAt: -1 }).lean(),
      getDbHealth()
    ]);

    const totalRevenue = approvedPayments.reduce((sum, p) => sum + p.amount, 0);

    return success(res, 'Overview data fetched', {
      activeNodes: totalUsers,
      teachers: totalTeachers,
      students: totalStudents,
      incompleteSignups: incompleteUsers,
      totalBanks,
      totalQuestions,
      totalTestsGenerated,
      pendingPayments,
      totalRevenue,
      recentSignups,
      activeAnnouncement: announcement || null,
      maintenanceMode: maintSetting?.value || false,
      systemHealth: {
        mainDb: dbHealth.mainDb.status,
        questionsDb: dbHealth.questionsDb.status,
        firebase: 'connected',
        gemini: process.env.GEMINI_API_KEY ? 'configured' : 'missing'
      }
    });
  } catch (err) {
    console.error('Overview Error:', err);
    return error(res, 'Failed to fetch overview data');
  }
};

// ============ USER MANAGEMENT ============

const getUsers = async (req, res) => {
  try {
    const { role, search, activated, page = 1, limit = 20 } = req.query;
    const query = {};

    // Default: Show only activated nodes unless specified otherwise
    if (activated === 'true' || !activated) {
      query.isActivated = true;
      query.role = { $in: ['teacher', 'student'] };
    } else if (activated === 'false') {
      query.$or = [
        { isActivated: false },
        { role: null }
      ];
    }

    if (role) query.role = role;
    if (search) {
      const safeSearch = escapeRegExp(search);
      query.$or = [
        { email: { $regex: safeSearch, $options: 'i' } },
        { displayName: { $regex: safeSearch, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('googleUid email displayName role isActivated planType createdAt isBlocked lastLoginAt')
      .lean();

    const total = await User.countDocuments(query);

    return success(res, 'Users fetched', {
      users,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    return error(res, 'Failed to fetch users');
  }
};

const getUserDetail = async (req, res) => {
  try {
    const { googleUid } = req.params;
    const user = await User.findOne({ googleUid });
    if (!user) return error(res, 'User not found', 'NOT_FOUND', 404);

    const [banks, activity, tests, doubts] = await Promise.all([
      Bank.find({ teacherId: googleUid }),
      ActivityLog.find({ userId: googleUid }).sort({ createdAt: -1 }).limit(50),
      TestSession.find({ userId: googleUid }).sort({ createdAt: -1 }),
      Doubt.find({ userId: googleUid }).sort({ createdAt: -1 })
    ]);

    return success(res, 'User detail fetched', {
      profile: user,
      banks,
      activity,
      tests,
      doubts
    });
  } catch (err) {
    return error(res, 'Failed to fetch user detail');
  }
};

const blockUser = async (req, res) => {
  const { googleUid } = req.params;
  const { actionCode } = req.body;

  if (!verifyActionCode('block_user', actionCode)) {
    return error(res, 'Invalid action code', 'INVALID_CODE', 403);
  }

  await User.findOneAndUpdate({ googleUid }, { isBlocked: true });
  
  await ActivityLog.create({
    userId: `ADMIN_${req.admin.adminId}`,
    type: 'user_blocked',
    title: 'User Blocked',
    description: `User ${googleUid} was blocked by admin.`,
    ip: req.ip,
    color: '#e74c3c'
  });

  return success(res, 'User blocked successfully');
};

const unblockUser = async (req, res) => {
  const { googleUid } = req.params;
  const { actionCode } = req.body;

  if (!verifyActionCode('unblock_user', actionCode)) {
    return error(res, 'Invalid action code', 'INVALID_CODE', 403);
  }

  await User.findOneAndUpdate({ googleUid }, { isBlocked: false });
  return success(res, 'User unblocked successfully');
};

const forceResetUser = async (req, res) => {
  const { googleUid } = req.params;
  const { actionCode } = req.body;

  if (!verifyActionCode('force_reset', actionCode)) {
    return error(res, 'Invalid action code', 'INVALID_CODE', 403);
  }

  await User.findOneAndUpdate({ googleUid }, { isActivated: false, role: null });
  return success(res, 'User reset successfully');
};

const deleteUser = async (req, res) => {
  try {
    const { googleUid } = req.params;
    const { actionCode } = req.body;

    // Verify secret code
    if (!verifyActionCode('delete_user', actionCode)) {
      return error(res, 'Invalid action code', 'INVALID_CODE', 403);
    }

    // Find user first
    const user = await User.findOne({ googleUid });
    if (!user) {
      return error(res, 'User not found', 'NOT_FOUND', 404);
    }

    // Get all banks owned by this user (if teacher)
    const banks = await Bank.find({ teacherId: googleUid });
    const bankIds = banks.map(b => b._id.toString());

    // === DELETE FROM QUESTIONS DB (Cluster 1) ===
    if (bankIds.length > 0) {
      await Question.deleteMany({
        bankId: { $in: bankIds }
      });
      console.log(`Deleted questions for ${bankIds.length} banks`);
    }

    // === DELETE FROM MAIN DB (Cluster 2) ===
    await Promise.all([
      // Core user data
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
      ActivityLog.deleteMany({ userId: googleUid }),
      PaymentRequest.deleteMany({ email: user.email }),
      Feedback.deleteMany({ userId: googleUid }), // Keeping this from original

      // Finally delete the user
      User.findOneAndDelete({ googleUid })
    ]);

    await ActivityLog.create({
      userId: `ADMIN_${req.admin.adminId}`,
      type: 'user_deleted',
      title: 'User Finalized',
      description: `All data for ${googleUid} was purged from both clusters.`,
      ip: req.ip,
      color: '#c0392b'
    });

    console.log(`User ${googleUid} and all associated data deleted successfully`);

    return success(res, 'User and all data deleted', null);
  } catch (err) {
    console.error('deleteUser error:', err.message);
    return error(res, 'Failed to delete user', 'SERVER_ERROR', 500);
  }
};

const updateUserName = async (req, res) => {
  try {
    const { googleUid } = req.params;
    const { newName } = req.body;

    if (!newName || newName.trim().length < 2) {
      return error(res, 'Invalid name. Min 2 characters required.', 'INVALID_NAME', 400);
    }

    const user = await User.findOneAndUpdate(
      { googleUid },
      { displayName: newName.trim() },
      { new: true }
    );

    if (!user) {
      return error(res, 'User not found', 'NOT_FOUND', 404);
    }

    await ActivityLog.create({
      userId: `ADMIN_${req.admin.adminId}`,
      type: 'user_updated',
      title: 'Name Changed Permanently',
      description: `Name for user ${googleUid} was changed to "${newName.trim()}" by admin.`,
      ip: req.ip,
      color: '#3498db'
    });

    return success(res, 'Student name updated permanently', {
      googleUid,
      displayName: user.displayName
    });
  } catch (err) {
    console.error('updateUserName error:', err);
    return error(res, 'Failed to update user name', 'SERVER_ERROR', 500);
  }
};

// ============ PAYMENT MANAGEMENT ============

const getPayments = async (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query;
  const query = {};

  if (status) query.status = status;
  if (search) {
    query.$or = [
      { utrNumber: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const payments = await PaymentRequest.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .lean();

  const total = await PaymentRequest.countDocuments(query);

  return success(res, 'Payments fetched', {
    payments,
    pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) }
  });
};

const approvePayment = async (req, res) => {
  const { id } = req.params;
  const { actionCode } = req.body;

  if (!verifyActionCode('approve_payment', actionCode)) {
    return error(res, 'Invalid action code', 'INVALID_CODE', 403);
  }

  const payment = await PaymentRequest.findById(id);
  if (!payment) return error(res, 'Payment not found', 'NOT_FOUND', 404);
  if (payment.status !== 'pending') return error(res, 'Payment already processed', 'PROCESSED', 400);

  // 2. Find and claim unused key in MongoDB
  const keyType = payment.paymentType === 'extra_slot' ? 'redeem' : 'activation';
  
  const keyDoc = await LicenseKey.findOneAndUpdate(
    { 
      type: keyType, 
      isUsed: false 
    },
    { 
      isUsed: true,
      usedBy: `PENDING_RESERVE_${payment.email}`, // Temporary identifier until user activates
      usedAt: new Date()
    },
    { new: true }
  );

  if (!keyDoc) {
    return error(res, `No unused ${keyType} keys available in key bank`, 'NO_KEYS', 400);
  }

  const licenseKey = keyDoc.key;

  // 4. Update payment
  payment.status = 'approved';
  payment.assignedKey = licenseKey;
  payment.reviewedBy = req.admin.adminId;
  payment.reviewedAt = new Date();
  await payment.save();

  // 5. Send approval email
  try {
    await sendPaymentApproved(payment.email, licenseKey, payment.paymentType);
  } catch (err) {
    console.error('Email Fail:', err);
  }

  await ActivityLog.create({
    userId: `ADMIN_${req.admin.adminId}`,
    type: 'student_approved', // Reusing this type or could add 'payment_approved'
    title: 'Payment Approved',
    description: `Approved ${payment.paymentType} for ${payment.email}. Key: ${licenseKey}`,
    ip: req.ip,
    color: '#2ecc71'
  });

  return success(res, 'Payment approved and key sent');
};

const rejectPayment = async (req, res) => {
  const { id } = req.params;
  const { actionCode, reason } = req.body;

  if (!verifyActionCode('reject_payment', actionCode)) {
    return error(res, 'Invalid action code', 'INVALID_CODE', 403);
  }

  const payment = await PaymentRequest.findById(id);
  if (!payment) return error(res, 'Payment not found', 'NOT_FOUND', 404);

  payment.status = 'rejected';
  payment.rejectionReason = reason;
  payment.reviewedBy = req.admin.adminId;
  payment.reviewedAt = new Date();
  await payment.save();

  try {
    await sendPaymentRejected(payment.email, reason);
  } catch (err) {
    console.error('Email Fail:', err);
  }

  return success(res, 'Payment rejected and email sent');
};

const deletePaymentRequest = async (req, res) => {
  const { id } = req.params;
  const { actionCode } = req.body;

  if (!verifyActionCode('delete_payment', actionCode)) {
    return error(res, 'Invalid action code', 'INVALID_CODE', 403);
  }

  const mongoose = require('mongoose');
  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.warn(`[ADMIN_ACTION] Invalid ID format provided: ${id}`);
    return error(res, 'Invalid ID format', 'INVALID_ID', 400);
  }

  console.log(`[ADMIN_ACTION] Deleting payment request: ${id}`);
  const payment = await PaymentRequest.findOneAndDelete({ _id: id });
  
  if (!payment) {
    console.warn(`[ADMIN_ACTION] Payment not found for deletion: ${id}`);
    return error(res, 'Payment not found', 'NOT_FOUND', 404);
  }

  console.log(`[ADMIN_ACTION] Payment deleted successfully: ${id}`);
  return success(res, 'Payment request deleted');
};

const deleteLicenseKey = async (req, res) => {
  const { id } = req.params;
  const { actionCode } = req.body;

  if (!verifyActionCode('delete_key', actionCode)) {
    return error(res, 'Invalid action code', 'INVALID_CODE', 403);
  }

  const mongoose = require('mongoose');
  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.warn(`[ADMIN_ACTION] Invalid ID format provided: ${id}`);
    return error(res, 'Invalid ID format', 'INVALID_ID', 400);
  }

  console.log(`[ADMIN_ACTION] Deleting license key: ${id}`);
  const key = await LicenseKey.findOneAndDelete({ _id: id });

  if (!key) {
    console.warn(`[ADMIN_ACTION] Key not found for deletion: ${id}`);
    return error(res, 'Key not found', 'NOT_FOUND', 404);
  }

  console.log(`[ADMIN_ACTION] Key deleted successfully: ${id}`);
  return success(res, 'License key deleted');
};

const getPaymentStats = async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    pendingCount,
    approvedCount,
    rejectedCount,
    allApproved,
    todayApproved
  ] = await Promise.all([
    PaymentRequest.countDocuments({ status: 'pending' }),
    PaymentRequest.countDocuments({ status: 'approved' }),
    PaymentRequest.countDocuments({ status: 'rejected' }),
    PaymentRequest.find({ status: 'approved' }),
    PaymentRequest.find({ status: 'approved', reviewedAt: { $gte: today } })
  ]);

  const totalRevenue = allApproved.reduce((sum, p) => sum + p.amount, 0);
  const todayRevenue = todayApproved.reduce((sum, p) => sum + p.amount, 0);

  return success(res, 'Payment stats fetched', {
    pendingCount,
    approvedCount,
    rejectedCount,
    totalRevenue,
    todayRevenue
  });
};

// GET /api/admin/keys/stats
const getKeyStats = async (req, res) => {
  try {
    const [
      totalActivation,
      usedActivation,
      totalRedeem,
      usedRedeem
    ] = await Promise.all([
      LicenseKey.countDocuments(
        { type: 'activation' }),
      LicenseKey.countDocuments(
        { type: 'activation', isUsed: true }),
      LicenseKey.countDocuments(
        { type: 'redeem' }),
      LicenseKey.countDocuments(
        { type: 'redeem', isUsed: true })
    ]);

    return success(res, 'Key stats', {
      activation: {
        total: totalActivation,
        used: usedActivation,
        available: totalActivation -
          usedActivation
      },
      redeem: {
        total: totalRedeem,
        used: usedRedeem,
        available: totalRedeem - usedRedeem
      }
    });
  } catch (err) {
    return error(res,
      'Failed to get key stats',
      'SERVER_ERROR', 500);
  }
};

// GET /api/admin/keys
// Query: ?type=activation|redeem
//        &status=used|unused
//        &page=1&limit=50&search=key
const getKeys = async (req, res) => {
  try {
    const {
      type, status, page = 1,
      limit = 50, search
    } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (status === 'used')
      filter.isUsed = true;
    if (status === 'unused')
      filter.isUsed = false;
    if (search) {
      filter.key = {
        $regex: search,
        $options: 'i'
      };
    }

    const [keys, total] = await Promise.all([
      LicenseKey.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean(),
      LicenseKey.countDocuments(filter)
    ]);

    return success(res, 'Keys', {
      keys,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    return error(res,
      'Failed to get keys',
      'SERVER_ERROR', 500);
  }
};

// POST /api/admin/keys/generate
const generateKeys = async (req, res) => {
  try {
    const { actionCode, count,
      keyType } = req.body;

    // Remove: plan, subjectSlots logic

    if (!verifyActionCode(
        'generate_keys', actionCode)) {
      return error(res,
        'Invalid action code',
        'INVALID_CODE', 403);
    }

    const total = Math.min(
      parseInt(count) || 100, 2000);
    const BATCH = 500;

    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const genKey = (type) => {
      const seg = () => Array.from(
        { length: 4 },
        () => chars[Math.floor(
          Math.random() * chars.length)]
      ).join('');
      const prefix = type === 'activation'
        ? 'BEE' : 'RDM';
      return `${prefix}-${seg()}-${seg()}-${seg()}`;
    };

    let generated = 0;
    for (let i = 0; i < total;
         i += BATCH) {
      const batchCount = Math.min(
        BATCH, total - i);
      const docs = Array.from(
        { length: batchCount },
        () => ({
          key: genKey(keyType),
          type: keyType || 'activation',
          isUsed: false
          // NO plan field
          // NO subjectSlots field
        })
      );
      await LicenseKey.insertMany(
        docs, { ordered: false });
      generated += batchCount;
    }

    return success(res,
      `${generated} keys generated`, {
      generated,
      type: keyType
    });
  } catch (err) {
    return error(res,
      'Generation failed',
      'SERVER_ERROR', 500);
  }
};




// ============ FEEDBACK ============

const getFeedback = async (req, res) => {
  const { type, context, page = 1 } = req.query;
  const limit = 20;
  const query = {};

  if (type) query.type = type;
  if (context) query.context = context;

  // Warm up User model for population
  const _u = User.modelName;

  const feedbacks = await Feedback.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('userId', 'displayName email role');

  return success(res, 'Feedback fetched', feedbacks);
};

const markFeedbackReviewed = async (req, res) => {
  const { id } = req.params;
  const { actionCode } = req.body;

  if (!verifyActionCode('mark_feedback', actionCode)) {
    return error(res, 'Invalid action code', 'INVALID_CODE', 403);
  }

  await Feedback.findByIdAndUpdate(id, { status: 'reviewed' });
  return success(res, 'Feedback marked as reviewed');
};

const deleteFeedback = async (req, res) => {
  const { id } = req.params;
  const { actionCode } = req.body;

  if (!verifyActionCode('delete_feedback', actionCode)) {
    return error(res, 'Invalid action code', 'INVALID_CODE', 403);
  }

  await Feedback.findByIdAndDelete(id);
  return success(res, 'Feedback deleted');
};

// ============ BANK MANAGEMENT ============

const getBanks = async (req, res) => {
  try {
    const { search, page = 1 } = req.query;
    const limit = 20;
    const query = {};

    if (search) {
      const safeSearch = escapeRegExp(search);
      query.$or = [
        { subject: { $regex: safeSearch, $options: 'i' } },
        { teacherName: { $regex: safeSearch, $options: 'i' } }
      ];
    }

    // Warm up User model for population
    const _u = User.modelName;

    const [banks, total] = await Promise.all([
      Bank.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('teacherId', 'displayName email')
        .lean(),
      Bank.countDocuments(query)
    ]);

    // Map internal fields to frontend expectations
    const mappedBanks = banks.map(b => ({
      ...b,
      questionCount: b.totalQuestions || 0,
      studentCount: (b.approvedStudents && b.approvedStudents.length) || 0,
      teacherId: b.teacherId // Ensure this is the populated object
    }));

    return success(res, 'Banks fetched', mappedBanks);
  } catch (err) {
    console.error('getBanks Error:', err);
    return error(res, 'Failed to fetch bank data');
  }
};

const deactivateBank = async (req, res) => {
  const { bankId } = req.params;
  const { actionCode } = req.body;

  if (!verifyActionCode('deactivate_bank', actionCode)) {
    return error(res, 'Invalid action code', 'INVALID_CODE', 403);
  }

  await Bank.findByIdAndUpdate(bankId, { isActive: false });
  
  await ActivityLog.create({
    userId: `ADMIN_${req.admin.adminId}`,
    type: 'bank_deleted', // Reusing this for deactivation as well or add 'bank_deactivated'
    title: 'Bank Deactivated',
    description: `Bank ID ${bankId} was deactivated by admin.`,
    ip: req.ip,
    color: '#f39c12'
  });

  return success(res, 'Bank deactivated');
};

const deleteBank = async (req, res) => {
  try {
    const { bankId } = req.params;
    const { actionCode } = req.body;

    if (!verifyActionCode('delete_bank', actionCode)) {
      return error(res, 'Invalid action code', 'INVALID_CODE', 403);
    }

    const bank = await Bank.findById(bankId);
    if (!bank) {
      return error(res, 'Bank not found', 'NOT_FOUND', 404);
    }

    // Delete from Questions DB
    await Question.deleteMany({
      bankId: bankId.toString()
    });

    // Delete from Main DB
    await Promise.all([
      Note.deleteMany({ bankId }),
      AccessRequest.deleteMany({ bankId }),
      Doubt.deleteMany({ bankId }),
      Bank.findByIdAndDelete(bankId)
    ]);

    // Update teacher's stats
    // Recalculate teacher's subjects and classes from remaining banks
    const remainingBanks = await Bank.find({ teacherId: bank.teacherId });
    const uniqueSubjects = [...new Set(remainingBanks.map(b => b.subject))];
    const uniqueClasses = [...new Set(remainingBanks.map(b => b.class))];

    await User.updateOne(
      { googleUid: bank.teacherId },
      {
        subjects: uniqueSubjects,
        classes: uniqueClasses,
        $inc: {
          totalQuestions: -bank.totalQuestions
        }
      }
    );

    return success(res, 'Bank and all content deleted', null);
  } catch (err) {
    console.error('deleteBank error:', err.message);
    return error(res, 'Failed to delete bank', 'SERVER_ERROR', 500);
  }
};

// ============ ANALYTICS ============

const getAnalytics = async (req, res) => {
  // Mocking analytics query logic
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [dailySignups, testsPerDay, subjectDistribution] = await Promise.all([
    User.aggregate([
      { 
        $match: { 
          createdAt: { $gte: thirtyDaysAgo },
          isActivated: true,
          role: { $in: ['teacher', 'student'] }
        } 
      },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    TestSession.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    Bank.aggregate([
      { $group: { _id: "$subject", count: { $sum: 1 } } }
    ])
  ]);

  return success(res, 'Analytics fetched', {
    dailySignups,
    testsPerDay,
    subjectDistribution
  });
};

// ============ SYSTEM CONTROL ============

const getSettings = async (req, res) => {
  const settings = await AppSettings.find();
  return success(res, 'Settings fetched', settings);
};

const toggleMaintenance = async (req, res) => {
  const { actionCode, enabled, message } = req.body;

  const validCode = enabled 
    ? verifyActionCode('maintenance_on', actionCode) 
    : verifyActionCode('maintenance_off', actionCode);

  if (!validCode) return error(res, 'Invalid action code', 'INVALID_CODE', 403);

  await AppSettings.findOneAndUpdate(
    { key: 'maintenance_mode' },
    { value: enabled, updatedBy: req.admin.adminId, updatedAt: new Date() },
    { upsert: true }
  );

  // Sync with SystemConfig for public-facing checks
  await SystemConfig.findOneAndUpdate(
    { key: 'maintenance_mode' },
    { value: enabled, updatedBy: req.admin.adminId, updatedAt: new Date() },
    { upsert: true }
  );

  if (message) {
    await AppSettings.findOneAndUpdate(
      { key: 'maintenance_message' },
      { value: message, updatedBy: req.admin.adminId, updatedAt: new Date() },
      { upsert: true }
    );
  }

  return success(res, `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`);
};

const setAnnouncement = async (req, res) => {
  const { text, target, expiresAt } = req.body;

  await Announcement.updateMany({}, { isActive: false });
  const a = await Announcement.create({
    text,
    target: target || 'all',
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    createdBy: req.admin.adminId,
    isActive: true
  });

  return success(res, 'Announcement set successfully', a);
};

const removeAnnouncement = async (req, res) => {
  await Announcement.updateMany({}, { isActive: false });
  return success(res, 'All announcements deactivated');
};

const updateSystemKey = async (req, res) => {
  const { actionCode, keyType, newValue } = req.body;
  
  const codeMap = {
    'gemini': 'change_gemini',
    'resend': 'change_resend',
    'cors': 'change_cors',
    'mongodb': 'change_mongodb'
  };

  if (!verifyActionCode(codeMap[keyType], actionCode)) {
    return error(res, 'Invalid action code', 'INVALID_CODE', 403);
  }

  // Update AppSettings
  await AppSettings.findOneAndUpdate(
    { key: `${keyType}_key` },
    { value: newValue, updatedBy: req.admin.adminId, updatedAt: new Date() },
    { upsert: true }
  );

  // Update process.env for immediate effect
  const envMap = {
    'gemini': 'GEMINI_API_KEY',
    'resend': 'RESEND_API_KEY',
    'mongodb': 'MONGODB_URI'
  };
  
  if (envMap[keyType]) {
    process.env[envMap[keyType]] = newValue;
  }

  return success(res, `System key ${keyType} updated`);
};

const getLogs = async (req, res) => {
  try {
    const { level = 'error', limit = 100 } = req.query;
    const logPath = path.join(__dirname, '../logs/error.log');
    
    if (!fs.existsSync(logPath)) return success(res, 'No logs found', []);

    const logs = fs.readFileSync(logPath, 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .slice(-parseInt(limit));

    return success(res, 'Logs fetched', logs);
  } catch (err) {
    return error(res, 'Failed to fetch logs');
  }
};

const clearLogs = async (req, res) => {
  const { actionCode } = req.body;
  if (!verifyActionCode('clear_logs', actionCode)) {
    return error(res, 'Invalid action code', 'INVALID_CODE', 403);
  }

  const logDir = path.join(__dirname, '../logs');
  if (fs.existsSync(logDir)) {
    ['error.log', 'combined.log'].forEach(file => {
      const f = path.join(logDir, file);
      if (fs.existsSync(f)) fs.writeFileSync(f, '');
    });
  }

  return success(res, 'Logs cleared');
};

const restartServer = async (req, res) => {
  const { actionCode } = req.body;
  if (!verifyActionCode('restart_server', actionCode)) {
    return error(res, 'Invalid action code', 'INVALID_CODE', 403);
  }

  success(res, 'Server restarting...');
  
  setTimeout(() => {
    process.exit(0); // PM2 or nodemon will restart
  }, 1000);
};

// ============ BLACKLIST MGMT ============

const getBlacklist = async (req, res) => {
  try {
    const list = await Blacklist.find().sort({ createdAt: -1 });
    return success(res, 'Blacklist fetched', list);
  } catch (err) {
    return error(res, 'Failed to fetch blacklist');
  }
};

const addToBlacklist = async (req, res) => {
  const { email, actionCode } = req.body;
  if (!verifyActionCode('manage_blacklist', actionCode)) {
    return error(res, 'Invalid action code', 'INVALID_CODE', 403);
  }

  if (!email) return error(res, 'Email required');

  try {
    await Blacklist.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { blockedBy: req.admin.adminId, blockedAt: new Date() },
      { upsert: true, new: true }
    );
    
    // Also block the user record if it exists
    await User.findOneAndUpdate({ email: email.toLowerCase().trim() }, { isBlocked: true });

    return success(res, 'Email added to system blacklist');
  } catch (err) {
    return error(res, 'Failed to blacklist email');
  }
};

const removeFromBlacklist = async (req, res) => {
  const { email, actionCode } = req.body;
  if (!verifyActionCode('manage_blacklist', actionCode)) {
    return error(res, 'Invalid action code', 'INVALID_CODE', 403);
  }

  try {
    await Blacklist.findOneAndDelete({ email: email.toLowerCase().trim() });
    
    // Optional: Also unblock the user record if it exists
    await User.findOneAndUpdate({ email: email.toLowerCase().trim() }, { isBlocked: false });

    return success(res, 'Email removed from blacklist');
  } catch (err) {
    return error(res, 'Failed to remove from blacklist');
  }
};

const getStorageStats = async (req, res) => {
  try {
    const { getMainConn, getQuestionsConn } = require('../config/db');
    const mainConn = getMainConn();
    const questionsConn = getQuestionsConn();

    const mainStats = await mainConn.db.command({ dbStats: 1 });
    const questionsStats = await questionsConn.db.command({ dbStats: 1 });

    const toMB = (bytes) => (bytes / 1024 / 1024).toFixed(2);

    return success(res, 'Storage stats', {
      mainDb: {
        usedMB: toMB(mainStats.dataSize),
        storageMB: toMB(mainStats.storageSize),
        limitMB: 512,
        percentUsed: ((mainStats.dataSize / (512 * 1024 * 1024)) * 100).toFixed(1)
      },
      questionsDb: {
        usedMB: toMB(questionsStats.dataSize),
        storageMB: toMB(questionsStats.storageSize),
        limitMB: 512,
        percentUsed: ((questionsStats.dataSize / (512 * 1024 * 1024)) * 100).toFixed(1)
      },
      firestore: {
        note: 'Track manually in Firebase Console',
        dailyReadLimit: 50000,
        dailyWriteLimit: 20000
      },
      cloudinary: {
        note: 'Check Cloudinary dashboard',
        storageLimitGB: 25,
        bandwidthLimitGB: 25
      }
    });
  } catch (err) {
    return error(res, 'Failed to get storage stats', 'SERVER_ERROR', 500);
  }
};

const getActivity = async (req, res) => {
  try {
    const { limit = 50, userId } = req.query;

    const filter = userId ? { userId } : {};

    const activities = await ActivityLog
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    // Enrich with user info
    const enriched = await Promise.all(
      activities.map(async (act) => {
        const user = await User.findOne(
          { googleUid: act.userId },
          'email displayName role'
        ).lean();
        return {
          ...act,
          userEmail: user?.email || 'Unknown',
          userName: user?.displayName || 'Unknown',
          userRole: user?.role || 'unknown'
        };
      })
    );

    return success(res, 'Activity feed', enriched);
  } catch (err) {
    return error(res, 'Failed to fetch activity', 'SERVER_ERROR', 500);
  }
};

const bulkUploadQuestions = async (req, res) => {
  try {
    const {
      teacherUid, bankId,
      chapterId, questionsText, actionCode
    } = req.body;

    // Security Gate: Bulk operations verification (Bypassed)
    /*
    if (!verifyActionCode('bulk_upload', actionCode)) {
      return error(res, 'Invalid action code for bulk injection', 'INVALID_CODE', 403);
    }
    */

    // Verify bank exists and get metadata
    const bank = await Bank.findById(bankId);
    if (!bank) {
      return error(res, 'Bank not found', 'NOT_FOUND', 404);
    }

    // Parse questions from text format
    const parseQuestions = (text) => {
      const blocks = text.split('---')
        .map(b => b.trim())
        .filter(b => b.length > 0);

      if (blocks.length > 100) {
        throw new Error('Maximum 100 questions per upload');
      }

      return blocks.map((block, idx) => {
        const lines = block.split('\n')
          .map(l => l.trim())
          .filter(l => l.length > 0);

        const q = {
          bankId: bankId.toString(),
          chapterId: chapterId || 'general',
          teacherId: bank.teacherId, // Required by model
          class: bank.class,         // Required by model
          subject: bank.subject,     // Required by model
          createdBy: teacherUid || bank.teacherId,
          isImportant: false
        };

        const options = {};
        let correctOption = null;

        for (const line of lines) {
          if (line.startsWith('Q:')) {
            q.questionText = line.substring(2).trim();
          } else if (line.startsWith('TYPE:')) {
            const rawType = line.substring(5).trim().toLowerCase();
            const typeMap = {
              'mcq': 'MCQ',
              'short': 'Short',
              'very_short': 'Very Short',
              'long': 'Long',
              'essay': 'Essay'
            };
            q.questionType = typeMap[rawType] || 'Short';
          } else if (line.startsWith('MARKS:')) {
            q.marks = parseInt(line.substring(6).trim()) || 1;
          } else if (line.startsWith('DIFFICULTY:')) {
            const rawDiff = line.substring(11).trim().toLowerCase();
            const diffMap = {
              'easy': 'Easy',
              'medium': 'Medium',
              'hard': 'Hard'
            };
            q.difficulty = diffMap[rawDiff] || 'Medium';
          } else if (line.startsWith('TAGS:')) {
            const tags = line.substring(5).split(',').map(t => t.trim());
            q.tags = tags.filter(t => ['Important', 'Repeated', 'Exam Focus', 'Formula Based'].includes(t));
            q.isImportant = q.tags.includes('Important');
          } else if (/^[A-D]:/.test(line)) {
            const hasCheck = line.includes('✓');
            const optText = line.substring(3).replace('✓', '').trim();
            const optLetter = line.charAt(0);
            options[optLetter] = optText;
            if (hasCheck) correctOption = optLetter;
          }
        }

        if (Object.keys(options).length > 0) {
          q.mcqOptions = options;
          q.correctOption = correctOption;
        }

        if (!q.questionText) throw new Error(`Question ${idx + 1} missing Q: text`);
        if (!q.questionType) q.questionType = 'Short';
        if (!q.marks) q.marks = 1;

        return q;
      });
    };

    let parsed;
    try {
      parsed = parseQuestions(questionsText);
    } catch (parseErr) {
      return error(res,
        parseErr.message,
        'PARSE_ERROR', 400);
    }

    // Save to Questions DB (Cluster 1)
    const saved = await Question.insertMany(parsed);

    // Update bank question count
    await Bank.findByIdAndUpdate(bankId, {
      $inc: { totalQuestions: saved.length }
    });

    // Update chapter counts atomically
    for (const q of saved) {
      await Bank.updateOne(
        { _id: bankId },
        { 
          $inc: { 'chapters.$[ch].questionCount': 1 }
        },
        { 
          arrayFilters: [{ 'ch.chapterId': q.chapterId }] 
        }
      );
    }

    // Update teacher total questions
    await User.updateOne(
      { googleUid: teacherUid },
      { $inc: { totalQuestions: saved.length } }
    );

    return success(res,
      `${saved.length} questions uploaded`, {
      uploaded: saved.length,
      questions: saved.map(q => ({
        id: q._id,
        text: q.questionText,
        type: q.questionType
      }))
    });

  } catch (err) {
    console.error('bulkUpload error:', err.message);
    return error(res,
      'Bulk upload failed: ' + err.message,
      'SERVER_ERROR', 500);
  }
};

const getTeachers = async (req, res) => {
  try {
    const teachers = await User.find({
      role: 'teacher',
      isActivated: true
    }).select('googleUid displayName email beeId').lean();
    return success(res, 'Teachers', teachers);
  } catch (err) {
    return error(res, 'Failed to fetch teachers', 'SERVER_ERROR', 500);
  }
};

const getTeacherBanks = async (req, res) => {
  try {
    const { uid } = req.params;
    const banks = await Bank.find({
      teacherId: uid,
      isActive: true
    }).select('_id subject class chapters totalQuestions').lean();
    return success(res, 'Banks', banks);
  } catch (err) {
    return error(res, 'Failed to fetch banks', 'SERVER_ERROR', 500);
  }
};

const getStudyCircles = async (req, res) => {
  try {
    const circles = await StudyCircle.find().select('name subject circleCode createdBy members isActive createdAt').lean();
    return success(res, 'Study Circles', circles);
  } catch (err) {
    return error(res, 'Failed to fetch circles', 'SERVER_ERROR', 500);
  }
};

const deleteStudyCircle = async (req, res) => {
  try {
    const { id } = req.params;
    const { actionCode } = req.body;
    if (!verifyActionCode('delete_bank', actionCode)) {
      return error(res, 'Invalid action code', 'INVALID_CODE', 403);
    }
    await StudyCircle.findByIdAndDelete(id);
    return success(res, 'Circle permanently deleted');
  } catch (err) {
    return error(res, 'Failed to delete circle', 'SERVER_ERROR', 500);
  }
};

module.exports = {
  adminLogin, adminLogout, verifySession,
  getOverview, getUsers, getUserDetail,
  blockUser, unblockUser, forceResetUser,
  deleteUser, getPayments, approvePayment,
  rejectPayment, getPaymentStats,
  getKeyStats, generateKeys, getKeys,
  getFeedback, markFeedbackReviewed,
  deleteFeedback, getBanks, deactivateBank,
  deleteBank, getAnalytics, getSettings,
  toggleMaintenance, setAnnouncement,
  removeAnnouncement, updateSystemKey,
  getLogs, clearLogs, restartServer,
  getBlacklist, addToBlacklist, removeFromBlacklist,
  updateUserName, getActivity, getStorageStats,
  bulkUploadQuestions, getTeachers, getTeacherBanks,
  deletePaymentRequest, deleteLicenseKey,
  getStudyCircles, deleteStudyCircle
};
