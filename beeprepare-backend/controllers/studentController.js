const bcrypt = require('bcryptjs');
const { connectDB } = require('../config/db');
const crypto = require('crypto');
const { db, bucket } = require('../config/firebase');
const User = require('../models/User');
const Bank = require('../models/Bank');
const Question = require('../models/Question');
const AccessRequest = require('../models/AccessRequest');
const Doubt = require('../models/Doubt');
const TestSession = require('../models/TestSession');
const Streak = require('../models/Streak');
const Bookmark = require('../models/Bookmark');
const ActivityLog = require('../models/ActivityLog');
const { updateStreak, syncStreak } = require('../utils/streakHelper');
const Note = require('../models/Note');
const Quote = require('../models/Quote');
const { success, error } = require('../utils/responseHelper');
const { generatePdfUrl } = require('../utils/cloudinaryHelper');
const getChapterId = require('../utils/getChapterId');


// ─── Helpers ──────────────────────────────────────────────────────────────────
const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const logActivity = async (userId, type, title, description, color = '#FFD700') => {
  try {
    await ActivityLog.create({ userId, type, title, description, color });
  } catch (e) {
    console.error('ActivityLog write failed:', e.message);
  }
};

// Extract Firebase Storage path from a URL or return as-is if it's already a path
const getStoragePath = (fileUrl) => {
  try {
    const url = new URL(fileUrl);
    const pathMatch = url.pathname.match(/\/o\/(.+)/);
    if (pathMatch) return decodeURIComponent(pathMatch[1]);
  } catch (_) {}
  // Already a plain path
  return fileUrl;
};

const generateSignedUrl = async (fileUrl) => {
  try {
    if (!fileUrl) return null;
    // If it's a Cloudinary URL, return it directly
    if (fileUrl.includes('cloudinary.com')) return fileUrl;

    const storagePath = getStoragePath(fileUrl);
    // If it's not a Firebase URL (no bucket reference), return as is
    if (!fileUrl.includes('storage.googleapis.com') && !fileUrl.includes('firebasestorage')) {
      return fileUrl;
    }

    const [signedUrl] = await bucket.file(storagePath).getSignedUrl({
      action: 'read',
      expires: Date.now() + parseInt(process.env.SIGNED_URL_EXPIRY_SECONDS || 3600) * 1000
    });
    return signedUrl;
  } catch (e) {
    console.warn('Firebase Signed URL skipped/failed:', e.message);
    return fileUrl; // Fallback to raw URL
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 1. GET /api/student/dashboard
// ══════════════════════════════════════════════════════════════════════════════
const getDashboard = async (req, res) => {
  try {
    await connectDB();
    const studentId = req.user.googleUid;

    const [streak, testSessions, recentDoubts, activityLogs] = await Promise.all([
      syncStreak(studentId),
      TestSession.find({ studentId, status: 'completed' }).select('subject scorePercent bankId createdAt').lean(),
      Doubt.find({ studentId }).sort({ createdAt: -1 }).limit(3).lean(),
      ActivityLog.find({ userId: studentId }).sort({ createdAt: -1 }).limit(10).lean()
    ]);

    const activeBanks = req.user.activeBanks || [];
    const testsTaken = testSessions.length;
    const avgScorePercent = testsTaken > 0
      ? Math.round(testSessions.reduce((sum, t) => sum + (t.scorePercent || 0), 0) / testsTaken)
      : 0;

    // Build subjects from active banks
    const bankIds = activeBanks.map(b => b.bankId);
    const banks = bankIds.length > 0 ? await Bank.find({ _id: { $in: bankIds } }).select('subject class totalQuestions').lean() : [];

    const subjects = banks.map(bank => {
      const bankTests = testSessions.filter(t => t.bankId?.toString() === bank._id.toString());
      const progressPercent = bank.totalQuestions > 0
        ? Math.min(Math.round((bankTests.length / Math.max(bank.totalQuestions, 1)) * 100), 100)
        : 0;
      return {
        subject: bank.subject,
        class: bank.class,
        bankId: bank._id,
        totalQuestions: bank.totalQuestions,
        progressPercent
      };
    });

    let dailyQuote = { text: "Keep the BEE matrix aligned with your goals.", author: "BEE Team", category: "academic" };
    try {
      const quoteCount = await Quote.countDocuments();
      if (quoteCount > 0) {
        const todayString = new Date().toISOString().split('T')[0];
        let hash = 0;
        for (let i = 0; i < todayString.length; i++) {
          hash = ((hash << 5) - hash) + todayString.charCodeAt(i);
          hash |= 0;
        }
        const index = Math.abs(hash) % quoteCount;
        const q = await Quote.findOne().skip(index).lean();
        if (q) dailyQuote = { text: q.text, author: q.author || 'Be Prepare', category: q.category };
      }
    } catch (quoteErr) {
      console.warn('Quote fetch failed:', quoteErr.message);
    }

    return success(res, 'Dashboard data fetched', {
      displayName: req.user.displayName,
      photoUrl: req.user.photoUrl,
      streak: streak
        ? { current: streak.currentStreak, best: streak.bestStreak, lastActiveDate: streak.lastActiveDate }
        : { current: 0, best: 0, lastActiveDate: null },
      stats: {
        testsTaken,
        avgScorePercent,
        activeBanks: activeBanks.length
      },
      subjects,
      recentDoubts: recentDoubts.map(d => ({
        doubtId: d._id,
        subject: d.subject,
        status: d.status,
        preview: d.messages?.[0]?.content?.substring(0, 50) || '',
        unreadByStudent: d.unreadByStudent,
        lastReplyAt: d.lastReplyAt
      })),
      activityLog: activityLogs,
      dailyQuote
    });
  } catch (err) {
    console.error('getDashboard error:', err);
    return error(res, 'Failed to fetch dashboard', 'SERVER_ERROR', 500);
  }
};


// ══════════════════════════════════════════════════════════════════════════════
// 2. GET /api/student/profile
// ══════════════════════════════════════════════════════════════════════════════
const getProfile = async (req, res) => {
  try {
    await connectDB();
    const studentId = req.user.googleUid;

    const [streak, testAgg, queryCount] = await Promise.all([
      syncStreak(studentId),
      TestSession.aggregate([
        { $match: { studentId, status: 'completed' } },
        { $group: { _id: null, count: { $sum: 1 }, avgScore: { $avg: '$scorePercent' } } }
      ]),
      Doubt.countDocuments({ studentId })
    ]);

    const stats = testAgg[0] || { count: 0, avgScore: 0 };
    const user = req.user;

    // Self-healing: Assign beeId if missing
    if (!user.beeId) {
        const generateBeeId = () => {
            const chars = '0123456789';
            let num = '';
            for (let i = 0; i < 4; i++) num += chars[Math.floor(Math.random() * chars.length)];
            return `STU-${num}`;
        };
        let newId;
        let attempts = 0;
        do {
            newId = generateBeeId();
            const exists = await User.findOne({ beeId: newId }).select('_id').lean();
            if (!exists) break;
            attempts++;
        } while (attempts < 10);
        
        await User.updateOne({ googleUid: studentId }, { beeId: newId });
        user.beeId = newId;
    }

    return success(res, 'Profile fetched', {
      googleUid: user.googleUid,
      email: user.email,
      displayName: user.displayName,
      photoUrl: user.photoUrl,
      phone: user.phone,
      beeId: user.beeId,
      class: user.class,
      planType: user.planType,
      isActivated: user.isActivated,
      aiMessagesToday: user.aiMessagesToday || 0,
      activeBanks: user.activeBanks || [],
      streak: streak
        ? { currentStreak: streak.currentStreak, bestStreak: streak.bestStreak, totalActiveDays: streak.totalActiveDays }
        : { currentStreak: 0, bestStreak: 0, totalActiveDays: 0 },
      stats: {
        testsTaken: stats.count,
        avgScore: Math.round(stats.avgScore || 0),
        queryCount: queryCount
      },
      createdAt: user.createdAt,
      nameChanged: user.nameChanged || false,
      licenseActivatedAt: user.licenseActivatedAt,
      licenseExpiresAt: user.licenseExpiresAt
    });
  } catch (err) {
    console.error('getProfile error:', err);
    return error(res, 'Failed to fetch profile', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 3. PUT /api/student/profile
// ══════════════════════════════════════════════════════════════════════════════
const updateProfile = async (req, res) => {
  try {
    const { displayName, phone, class: className } = req.body;
    const updates = {};

    if (displayName !== undefined) {
      if (typeof displayName !== 'string' || displayName.trim().length < 2) {
        return error(res, 'Display name must be at least 2 characters', 'INVALID_NAME', 400);
      }
      if (req.user.nameChanged) {
        return error(res, 'Identity is locked. You have already updated your protocol name once.', 'IDENTITY_LOCKED', 403);
      }
      updates.displayName = displayName.trim();
      updates.nameChanged = true;
    }

    if (phone !== undefined) updates.phone = phone;

    if (className !== undefined) {
      const validClasses = ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'];
      if (!validClasses.includes(className)) {
        return error(res, 'Class must be between Class 6 and 12', 'INVALID_CLASS', 400);
      }
      updates.class = className;
    }

    if (Object.keys(updates).length === 0) {
      return error(res, 'No valid fields to update', 'NO_UPDATES', 400);
    }

    await User.updateOne({ googleUid: req.user.googleUid }, updates);
    const updatedUser = await User.findOne({ googleUid: req.user.googleUid }).lean();
    return success(res, 'Profile updated successfully', updatedUser);
  } catch (err) {
    console.error('updateProfile error:', err);
    return error(res, 'Failed to update profile', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 4. POST /api/student/banks/search
// ══════════════════════════════════════════════════════════════════════════════
const searchBank = async (req, res) => {
  try {
    const { bankCode } = req.body;
    if (!bankCode || !bankCode.trim()) {
      return error(res, 'bankCode is required', 'MISSING_BANKCODE', 400);
    }

    const bank = await Bank.findOne({ bankCode: bankCode.trim().toUpperCase() })
      .select('-approvedStudents').lean(); // Never return this list to students

    if (!bank) return error(res, 'Bank not found. Check the code and try again.', 'BANK_NOT_FOUND', 404);

    const studentId = req.user.googleUid;
    const existingRequest = await AccessRequest.findOne({ bankId: bank._id, studentId }).select('status').lean();

    return success(res, 'Bank found', {
      bankId: bank._id,
      subject: bank.subject,
      class: bank.class,
      teacherName: bank.teacherName,
      bankCode: bank.bankCode,
      totalQuestions: bank.totalQuestions,
      notesCount: bank.notesCount,
      chaptersCount: bank.chapters.length,
      updatedAt: bank.updatedAt,
      alreadyRequested: !!existingRequest,
      alreadyActive: existingRequest?.status === 'active',
      requestStatus: existingRequest?.status || null
    });
  } catch (err) {
    console.error('searchBank error:', err);
    return error(res, 'Failed to search bank', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 5. POST /api/student/banks/request
// ══════════════════════════════════════════════════════════════════════════════
const requestAccess = async (req, res) => {
  try {
    const { bankId } = req.body;
    const studentId = req.user.googleUid;

    if (!bankId) return error(res, 'bankId is required', 'MISSING_BANKID', 400);

    const bank = await Bank.findById(bankId);
    if (!bank) return error(res, 'Bank not found', 'BANK_NOT_FOUND', 404);

    const existing = await AccessRequest.findOne({ bankId, studentId }).select('status').lean();
    if (existing) {
      return error(res, `You already have a ${existing.status} request for this bank`, 'DUPLICATE_REQUEST', 409);
    }

    const request = await AccessRequest.create({
      studentId,
      studentName: req.user.displayName,
      bankId,
      teacherId: bank.teacherId,
      status: 'pending',
      requestedAt: new Date()
    });

    await logActivity(
      studentId,
      'bank_joined',
      'Bank Access Requested',
      `Requested access to ${bank.subject} - ${bank.class}`,
      '#3B82F6'
    );

    return success(res, 'Access request sent to teacher', {
      requestId: request._id,
      status: 'pending',
      teacherName: bank.teacherName
    }, 201);
  } catch (err) {
    console.error('requestAccess error:', err);
    return error(res, 'Failed to send access request', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 6. GET /api/student/banks
// ══════════════════════════════════════════════════════════════════════════════
const getMyBanks = async (req, res) => {
  try {
    const studentId = req.user.googleUid;
    
    // Warm up Bank model for population
    const _b = Bank.modelName;

    const requests = await AccessRequest.find({ studentId })
      .populate('bankId', 'subject class teacherName bankCode totalQuestions notesCount')
      .lean();

    const banks = requests
      .filter(r => r.bankId) // Filter out deleted banks
      .map(r => ({
        requestId: r._id,
        bankId: r.bankId?._id,
        subject: r.bankId?.subject,
        class: r.bankId?.class,
        teacherName: r.bankId?.teacherName,
        bankCode: r.bankId?.bankCode,
        totalQuestions: r.bankId?.totalQuestions,
        notesCount: r.bankId?.notesCount,
        status: r.status,
        requestedAt: r.requestedAt,
        activatedAt: r.otpVerifiedAt || null
      }));

    // Sort: active first, then pending, then rejected
    const order = { active: 0, approved: 1, pending: 2, rejected: 3, locked: 4 };
    banks.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

    return success(res, 'Banks fetched', banks);
  } catch (err) {
    console.error('getMyBanks error:', err);
    return error(res, 'Failed to fetch banks', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 7. DELETE /api/student/banks/:bankId
// ══════════════════════════════════════════════════════════════════════════════
const deleteBank = async (req, res) => {
  try {
    const { bankId } = req.params;
    const studentId = req.user.googleUid;

    const request = await AccessRequest.findOne({ bankId, studentId });
    if (!request) return error(res, 'No request found for this bank', 'NOT_FOUND', 404);

    // If active, clean up approvedStudents and activeBanks
    if (request.status === 'active') {
      await Promise.all([
        Bank.updateOne({ _id: bankId }, { $pull: { approvedStudents: studentId } }),
        User.updateOne({ googleUid: studentId }, { $pull: { activeBanks: { bankId } } }),
        User.updateOne(
          { googleUid: request.teacherId },
          { $inc: { activeStudents: -1 } }
        )
      ]);
    }

    await AccessRequest.findByIdAndDelete(request._id);
    return success(res, 'Bank access removed successfully', null);
  } catch (err) {
    console.error('deleteBank error:', err);
    return error(res, 'Failed to remove bank', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 8. POST /api/student/banks/verify-otp  (Security-critical)
// ══════════════════════════════════════════════════════════════════════════════
const verifyOTP = async (req, res) => {
  try {
    const { requestId, otpCode } = req.body;
    const studentId = req.user.googleUid;

    if (!requestId || !otpCode) {
      return error(res, 'requestId and otpCode are required', 'MISSING_FIELDS', 400);
    }

    const request = await AccessRequest.findById(requestId);
    if (!request) return error(res, 'Access request not found', 'NOT_FOUND', 404);

    // Security checks
    if (request.studentId !== studentId) {
      return error(res, 'Access denied', 'FORBIDDEN', 403);
    }
    if (request.status === 'locked') {
      return error(res, 'This request is locked after too many wrong attempts. Contact your teacher.', 'REQUEST_LOCKED', 423);
    }
    if (request.status !== 'approved') {
      return error(res, 'This request has not been approved by your teacher yet', 'NOT_APPROVED', 400);
    }
    if (request.status === 'active') {
      return error(res, 'This bank is already active', 'ALREADY_ACTIVE', 409);
    }
    if (request.otpExpiresAt && new Date() > request.otpExpiresAt) {
      return error(res, 'OTP has expired. Ask your teacher to re-approve.', 'OTP_EXPIRED', 410);
    }

    const maxAttempts = parseInt(process.env.MAX_OTP_ATTEMPTS || 5);
    if (request.otpAttempts >= maxAttempts) {
      await AccessRequest.updateOne({ _id: requestId }, { status: 'locked' });
      return error(res, 'Account locked after too many attempts. Contact your teacher.', 'TOO_MANY_ATTEMPTS', 423);
    }

    // Verify OTP using bcrypt — NEVER plain text comparison
    const isCorrect = await bcrypt.compare(String(otpCode), request.otpHash);

    if (!isCorrect) {
      const newAttempts = request.otpAttempts + 1;
      const remaining = maxAttempts - newAttempts;
      const updateData = { otpAttempts: newAttempts };
      if (newAttempts >= maxAttempts) updateData.status = 'locked';
      await AccessRequest.updateOne({ _id: requestId }, updateData);

      if (newAttempts >= maxAttempts) {
        return error(res, 'Wrong OTP. Request locked — contact your teacher.', 'REQUEST_LOCKED', 423);
      }
      return error(res, `Wrong OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`, 'WRONG_OTP', 400, { attemptsRemaining: remaining });
    }

    // OTP correct — activate access
    const bank = await Bank.findById(request.bankId);
    if (!bank) return error(res, 'Bank not found', 'BANK_NOT_FOUND', 404);

    const now = new Date();
    await Promise.all([
      AccessRequest.updateOne({ _id: requestId }, {
        status: 'active',
        otpVerifiedAt: now
      }),
      Bank.updateOne({ _id: request.bankId }, {
        $addToSet: { approvedStudents: studentId }
      }),
      User.updateOne({ googleUid: studentId }, {
        $push: {
          activeBanks: {
            bankId: bank._id,
            subject: bank.subject,
            teacherId: bank.teacherId,
            activatedAt: now
          }
        }
      }),
      User.updateOne({ googleUid: bank.teacherId }, {
        $inc: { activeStudents: 1 }
      })
    ]);

    await logActivity(
      studentId,
      'bank_joined',
      'Bank Access Activated',
      `Now have access to ${bank.subject} - ${bank.class}`,
      '#4CAF50'
    );

    return success(res, 'OTP verified! Bank access granted.', {
      bankId: bank._id,
      subject: bank.subject,
      class: bank.class,
      teacherName: bank.teacherName
    });
  } catch (err) {
    console.error('verifyOTP error:', err);
    return error(res, 'Failed to verify OTP', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 9. GET /api/student/banks/:bankId/chapters
// ══════════════════════════════════════════════════════════════════════════════
const getBankChapters = async (req, res) => {
  try {
    const { bankId } = req.params;
    const studentId = req.user.googleUid;

    const bank = await Bank.findById(bankId);
    if (!bank) return error(res, 'Bank not found', 'BANK_NOT_FOUND', 404);

    if (!bank.approvedStudents.includes(studentId)) {
      return error(res, 'You do not have access to this bank', 'FORBIDDEN', 403);
    }

    return success(res, 'Chapters fetched', {
      bankId,
      subject: bank.subject,
      class: bank.class,
      teacherName: bank.teacherName,
      chapters: bank.chapters.sort((a, b) => a.order - b.order)
    });
  } catch (err) {
    console.error('getBankChapters error:', err);
    return error(res, 'Failed to fetch chapters', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 10. GET /api/student/notes
// ══════════════════════════════════════════════════════════════════════════════
const getNotes = async (req, res) => {
  try {
    const { bankId, chapterId } = req.query;
    const studentId = req.user.googleUid;

    if (!bankId) return error(res, 'Syllabus node ID is required.', 'MISSING_BANKID', 400);

    const bank = await Bank.findById(bankId).select('approvedStudents subject class teacherName');
    if (!bank) return error(res, 'Syllabus node not found.', 'BANK_NOT_FOUND', 404);

    if (!bank.approvedStudents.includes(studentId)) {
      return error(res, 'Access denied to this vault node.', 'FORBIDDEN', 403);
    }

    // 1. Fetch from Cloudinary Vault (Indexed in MongoDB)
    const filter = { bankId };
    if (chapterId) filter.chapterId = chapterId;
    
    const notes = await Note.find(filter).lean();

    // 2. Map and generate dynamic Cloudinary URLs
    const processedNotes = notes.map(note => ({
      noteId: note._id,
      chapterId: note.chapterId,
      chapterName: note.chapterName,
      noteType: note.noteType,
      fileName: note.fileName,
      fileType: note.fileType,
      fileSize: note.fileSize,
      fileUrl: generatePdfUrl(note.public_id, false, note.resource_type || 'raw', note.format), // Fresh URL for each request
      uploadedAt: note.createdAt
    }));

    // 3. Group by chapter for frontend alignment
    const grouped = {};
    for (const note of processedNotes) {
      if (!grouped[note.chapterId]) {
        grouped[note.chapterId] = {
          chapterId: note.chapterId,
          chapterName: note.chapterName,
          notes: []
        };
      }
      grouped[note.chapterId].notes.push(note);
    }

    return success(res, 'Vault notes synchronized.', {
      bankId,
      subject: bank.subject,
      class: bank.class,
      chapters: Object.values(grouped)
    });
  } catch (err) {
    console.error('getNotes vault fault:', err);
    return error(res, 'Vault synchronization failed.', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 11. POST /api/student/tests/generate
// ══════════════════════════════════════════════════════════════════════════════
const generateTest = async (req, res) => {
  try {
    const { bankId, selectedChapters, blueprint } = req.body;
    const studentId = req.user.googleUid;

    if (!bankId || !selectedChapters || !blueprint) {
      return error(res, 'bankId, selectedChapters, and blueprint are required', 'MISSING_FIELDS', 400);
    }

    const bank = await Bank.findById(bankId);
    if (!bank) return error(res, 'Bank not found', 'BANK_NOT_FOUND', 404);

    if (!bank.approvedStudents.includes(studentId)) {
      return error(res, 'You do not have access to this bank', 'FORBIDDEN', 403);
    }

    const allQuestions = await Question.find({
      bankId,
      chapterId: { $in: selectedChapters }
    });

    const pools = {
      MCQ: { key: 'MCQ', questions: [] },
      'Very Short': { key: 'Very Short', questions: [] },
      Short: { key: 'Short', questions: [] },
      Long: { key: 'Long', questions: [] },
      Essay: { key: 'Essay', questions: [] }
    };

    const normalizeType = (t) => {
      const type = (t || '').toLowerCase();
      if (type.includes('mcq') || type.includes('multiple choice')) return 'MCQ';
      if (type.includes('very short')) return 'Very Short';
      if (type.includes('short')) return 'Short';
      if (type.includes('long')) return 'Long';
      if (type.includes('essay')) return 'Essay';
      return 'Short'; // Default
    };

    for (const q of allQuestions) {
      const type = normalizeType(q.questionType);
      if (pools[type]) pools[type].questions.push(q);
    }

    const selected = [];
    const sectionDefs = [];
    const labels = ['A', 'B', 'C', 'D', 'E'];

    // blueprint: [{ type: 'MCQ', marks: 1, count: 5 }, ...]
    blueprint.forEach((sectionReq, idx) => {
      const typeName = sectionReq.type;
      const needed = parseInt(sectionReq.count) || 0;
      const requestedMarks = parseInt(sectionReq.marks) || 1;

      if (needed === 0) return;

      const foundPool = pools[typeName];
      if (!foundPool || foundPool.questions.length === 0) return;

      const importantPool = foundPool.questions.filter(q => q.isImportant || (q.tags && q.tags.includes('Important')));
      const normalPool = foundPool.questions.filter(q => !q.isImportant && !(q.tags && q.tags.includes('Important')));

      const importantNeeded = Math.ceil(needed * 0.70);
      const normalNeeded = needed - importantNeeded;

      let fromImportant, fromNormal;

      if (importantPool.length < importantNeeded) {
        const deficit = importantNeeded - importantPool.length;
        fromImportant = importantPool;
        fromNormal = shuffleArray(normalPool).slice(0, normalNeeded + deficit);
      } else {
        fromImportant = shuffleArray(importantPool).slice(0, importantNeeded);
        fromNormal = shuffleArray(normalPool).slice(0, normalNeeded);
      }

      let typeSelected = [...fromImportant, ...fromNormal].slice(0, needed);
      
      // Map to session schema (cross-DB safe) and apply blueprint marks
      typeSelected = typeSelected.map(q => {
        const plain = q.toObject ? q.toObject() : q;
        return {
          questionId: String(plain._id),
          questionText: plain.questionText,
          questionType: plain.questionType,
          marks: requestedMarks,
          mcqOptions: plain.mcqOptions,
          correctOption: plain.correctOption
        };
      });

      if (typeSelected.length > 0) {
        selected.push(...typeSelected);
        sectionDefs.push({
          label: labels[sectionDefs.length] || '?',
          type: typeName,
          marksEach: requestedMarks,
          count: typeSelected.length,
          total: typeSelected.length * requestedMarks
        });
      }
    });

    if (selected.length === 0) {
      return error(res, 'No questions match the selected chapters and blueprint requirements.', 'NO_QUESTIONS_FOUND', 400);
    }

    const totalMarks = selected.reduce((sum, q) => sum + (q.marks || 0), 0);

    // Build Premium Paper HTML (Professional Style)
    let paperHtml = `
<div class="paper-header" style="font-size: inherit;">
  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5em;">
    <div style="text-align: left;">
      <span style="font-weight: bold; border-bottom: 1px solid #000; padding: 2px 10px;">Roll No: _____________</span>
    </div>
    <div style="text-align: right; font-size: 0.8em; color: #666;">
      Code No: BP-ST-${Math.random().toString(36).substring(7).toUpperCase()}
    </div>
  </div>

  <h2 style="margin: 0; font-size: 1.5em; text-align: center; font-family: 'Times New Roman', serif;">BOARD OF ACADEMIC EXCELLENCE (BEEPREPARE)</h2>
  <h3 style="margin: 5px 0 1em 0; font-size: 1.2em; text-transform: uppercase; text-align: center; font-family: 'Times New Roman', serif;">ANNUAL EXAMINATION (2025–26)</h3>
  <h4 style="margin: 0; font-size: 1.3em; border-bottom: 2px solid #000; padding-bottom: 0.8em; text-align: center; font-family: 'Times New Roman', serif;">
    SUBJECT: ${bank.subject.toUpperCase()} (CLASS: ${bank.class})
  </h4>

  <div class="paper-meta-row" style="display: flex; justify-content: space-between; margin-top: 1em; font-weight: bold; font-size: 1em; font-family: 'Times New Roman', serif;">
    <span>Maximum Time: 3 Hours</span>
    <span>Maximum Marks: ${totalMarks}</span>
  </div>
</div>

<div style="margin: 1.5em 0; border: 1px solid #000; padding: 1em; font-size: 0.9em; line-height: 1.6; font-family: 'Times New Roman', serif;">
  <strong>GENERAL INSTRUCTIONS:</strong>
  <ol style="margin: 0.5em 0 0 1.5em; padding: 0;">
    <li>This question paper contains ${selected.length} questions across various sections.</li>
    <li>All questions are compulsory.</li>
    <li>Read each question carefully before answering.</li>
    <li>Maintain clean and legible handwriting.</li>
  </ol>
</div>`;

    let qNumber = 1;
    for (const [idx, section] of sectionDefs.entries()) {
      const sectionQs = selected.filter(q => q.questionType === section.type);
      if (sectionQs.length === 0) continue;

      paperHtml += `
      <div style="text-align: center; font-weight: bold; text-transform: uppercase; padding: 5px; background: #f2f2f2; border: 1px solid #ccc; margin: 20px 0 10px 0; font-family: sans-serif; font-size: 14px;">
        SECTION - ${section.label} (${section.type})
      </div>
      <div style="text-align: right; font-style: italic; font-size: 12px; margin-bottom: 10px;">
        (${section.count} Questions × ${section.marksEach} Mark${section.marksEach > 1 ? 's' : ''} Each)
      </div>`;

      for (const q of sectionQs) {
        paperHtml += `
        <div class="question-item" style="margin-bottom: 15px; font-family: 'Times New Roman', serif; position: relative;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="flex: 1; padding-right: 30px;">
              <strong>Q${qNumber}.</strong> ${q.questionText}
            </div>
            <div style="font-weight: bold; min-width: 30px; text-align: right;">
              [${q.marks}]
            </div>
          </div>`;

        if (q.questionType === 'MCQ' && q.mcqOptions) {
          paperHtml += `
          <div class="mcq-options-grid" style="margin: 0.8em 0 0 2.5em; display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5em 1.5em; font-size: 0.95em;">
            <div style="display: flex; gap: 8px;"><span style="font-weight: bold;">(A)</span> <span>${q.mcqOptions.A || ''}</span></div>
            <div style="display: flex; gap: 8px;"><span style="font-weight: bold;">(B)</span> <span>${q.mcqOptions.B || ''}</span></div>
            <div style="display: flex; gap: 8px;"><span style="font-weight: bold;">(C)</span> <span>${q.mcqOptions.C || ''}</span></div>
            <div style="display: flex; gap: 8px;"><span style="font-weight: bold;">(D)</span> <span>${q.mcqOptions.D || ''}</span></div>
          </div>`;
        }

        paperHtml += `
          <div class="q-actions" style="position: absolute; right: -30px; top: 0; display: none;">
            <div class="action-icon" title="Delete">×</div>
          </div>
        </div>`;
        qNumber++;
      }
    }

    const session = await TestSession.create({
      studentId,
      bankId: bank._id,
      teacherId: bank.teacherId,
      subject: bank.subject,
      class: bank.class,
      questions: selected,
      blueprint,
      totalMarks,
      status: 'in_progress',
      startedAt: new Date()
    });

    return success(res, 'Test generated successfully', {
      sessionId: session._id,
      paperHtml,
      totalMarks,
      questionCount: selected.length
    }, 201);
  } catch (err) {
    console.error('generateTest error:', err);
    return error(res, 'Failed to generate test', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 12. POST /api/student/tests/:sessionId/submit
// ══════════════════════════════════════════════════════════════════════════════
const submitTest = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { answers } = req.body;
    const studentId = req.user.googleUid;

    if (!answers || !Array.isArray(answers)) {
      return error(res, 'answers array is required', 'MISSING_ANSWERS', 400);
    }

    const session = await TestSession.findById(sessionId);
    if (!session) return error(res, 'Test session not found', 'NOT_FOUND', 404);
    if (session.studentId !== studentId) return error(res, 'Access denied', 'FORBIDDEN', 403);
    if (session.status === 'completed') return error(res, 'This test has already been submitted', 'ALREADY_SUBMITTED', 409);

    let score = 0;
    let correctCount = 0;
    let incorrectCount = 0;

    const gradedAnswers = answers.map(ans => {
      const question = session.questions.find(q => q.questionId?.toString() === ans.questionId?.toString());
      if (!question) return { questionId: ans.questionId, studentAnswer: ans.studentAnswer, isCorrect: null };

      let isCorrect = null;
      if (question.questionType === 'MCQ') {
        isCorrect = ans.studentAnswer === question.correctOption;
        if (isCorrect) {
          score += question.marks || 1;
          correctCount++;
        } else if (ans.studentAnswer) {
          incorrectCount++;
        }
      }
      // Non-MCQ: isCorrect stays null (manual review)
      return { questionId: ans.questionId, studentAnswer: ans.studentAnswer, isCorrect };
    });

    const scorePercent = session.totalMarks > 0
      ? Math.round((score / session.totalMarks) * 100)
      : 0;

    await TestSession.updateOne({ _id: sessionId }, {
      status: 'completed',
      answers: gradedAnswers,
      score,
      scorePercent,
      completedAt: new Date()
    });

    // Update streak
    const streak = await updateStreak(studentId);

    // Write activity log
    await logActivity(
      studentId,
      'test_completed',
      'Test Completed',
      `Scored ${scorePercent}% in ${session.subject}`,
      '#2196F3'
    );

    return success(res, 'Test submitted successfully', {
      score,
      scorePercent,
      totalMarks: session.totalMarks,
      correctCount,
      incorrectCount,
      streak: {
        currentStreak: streak.currentStreak,
        bestStreak: streak.bestStreak,
        totalActiveDays: streak.totalActiveDays
      }
    });
  } catch (err) {
    console.error('submitTest error:', err);
    return error(res, 'Failed to submit test', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 13. GET /api/student/tests/history
// ══════════════════════════════════════════════════════════════════════════════
const getTestHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const studentId = req.user.googleUid;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [sessions, total] = await Promise.all([
      TestSession.find({ studentId, status: 'completed' })
        .select('subject class totalMarks score scorePercent questions completedAt createdAt')
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      TestSession.countDocuments({ studentId, status: 'completed' })
    ]);

    return success(res, 'Test history fetched', {
      tests: sessions.map(s => ({
        sessionId: s._id,
        subject: s.subject,
        class: s.class,
        totalMarks: s.totalMarks,
        score: s.score,
        scorePercent: s.scorePercent,
        questionCount: s.questions?.length || 0,
        completedAt: s.completedAt
      })),
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    console.error('getTestHistory error:', err);
    return error(res, 'Failed to fetch test history', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 14. GET /api/student/doubts
// ══════════════════════════════════════════════════════════════════════════════
const getDoubts = async (req, res) => {
  try {
    const studentId = req.user.googleUid;

    const doubts = await Doubt.find({ studentId })
      .sort({ unreadByStudent: -1, lastReplyAt: -1 })
      .lean();

    return success(res, 'Doubts fetched', {
      doubts: doubts.map(d => ({
        doubtId: d._id,
        subject: d.subject,
        status: d.status,
        unreadByStudent: d.unreadByStudent,
        preview: d.messages?.[0]?.content?.substring(0, 60) || '',
        messageCount: d.messages?.length || 0,
        createdAt: d.createdAt,
        lastReplyAt: d.lastReplyAt
      }))
    });
  } catch (err) {
    console.error('getDoubts error:', err);
    return error(res, 'Failed to fetch doubts', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 15. POST /api/student/doubts
// ══════════════════════════════════════════════════════════════════════════════
const submitDoubt = async (req, res) => {
  try {
    const { bankId, subject, questionText, imageUrl } = req.body;
    const studentId = req.user.googleUid;

    if (!bankId || !questionText) {
      return error(res, 'bankId and questionText are required', 'MISSING_FIELDS', 400);
    }
    if (questionText.trim().length < 10) {
      return error(res, 'Question must be at least 10 characters', 'TOO_SHORT', 400);
    }
    if (questionText.trim().length > 500) {
      return error(res, 'To save database storage, please keep your question under 500 characters', 'TOO_LONG', 400);
    }

    const bank = await Bank.findById(bankId);
    if (!bank) return error(res, 'Bank not found', 'BANK_NOT_FOUND', 404);

    if (!bank.approvedStudents.includes(studentId)) {
      return error(res, 'You do not have access to this bank', 'FORBIDDEN', 403);
    }

    // Limit active doubts to max 3
    const activeDoubtsCount = await Doubt.countDocuments({
      studentId,
      status: { $ne: 'resolved' }
    });

    // Check for existing pending doubt to maintain thread continuity
    let doubt = await Doubt.findOne({ 
      studentId, 
      bankId, 
      status: { $ne: 'resolved' } 
    });

    if (!doubt && activeDoubtsCount >= 3) {
      return error(res, 'You have reached the maximum of 3 active doubts. Please mark older doubts as resolved before starting a new one.', 'MAX_DOUBTS_REACHED', 400);
    }

    if (doubt && doubt.messages.length >= 50) {
      return error(res, 'This doubt thread has reached the maximum 50 messages limit. Please mark it as resolved and start a new one if needed.', 'THREAD_FULL', 400);
    }

    // Process Base64 image to Cloudinary if needed to save DB storage
    let finalImageUrl = imageUrl || null;
    if (imageUrl && imageUrl.startsWith('data:image')) {
      try {
        const { cloudinary } = require('../utils/cloudinaryHelper');
        const uploadRes = await cloudinary.uploader.upload(imageUrl, {
          folder: `doubts/student_${studentId}`,
          resource_type: 'image',
          format: 'webp',
          quality: 'auto'
        });
        finalImageUrl = uploadRes.secure_url;
      } catch (uploadErr) {
        console.error('Cloudinary upload failure (student doubt):', uploadErr);
        return error(res, 'Failed to process image attachment', 'UPLOAD_ERROR', 500);
      }
    }

    const now = new Date();
    const newMessage = {
      messageId: crypto.randomUUID(),
      senderRole: 'student',
      content: questionText.trim(),
      imageUrl: finalImageUrl,
      timestamp: now
    };

    if (doubt) {
      // Resume existing thread
      doubt.messages.push(newMessage);
      doubt.unreadByTeacher = true;
      doubt.updatedAt = now;
      await doubt.save();
    } else {
      // Create new thread
      doubt = await Doubt.create({
        studentId,
        studentName: req.user.displayName,
        teacherId: bank.teacherId,
        bankId,
        subject: subject || bank.subject,
        status: 'pending',
        unreadByTeacher: true,
        unreadByStudent: false,
        messages: [newMessage],
        lastReplyAt: null
      });
    }

    return success(res, 'Doubt submitted successfully', {
      doubtId: doubt._id,
      status: doubt.status
    }, 201);
  } catch (err) {
    console.error('submitDoubt error:', err);
    return error(res, 'Failed to submit doubt', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 16. GET /api/student/doubts/:id/messages
// ══════════════════════════════════════════════════════════════════════════════
const getDoubtMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const studentId = req.user.googleUid;

    const doubt = await Doubt.findById(id);
    if (!doubt) return error(res, 'Doubt not found', 'NOT_FOUND', 404);
    if (doubt.studentId !== studentId) return error(res, 'Access denied', 'FORBIDDEN', 403);

    // Apply Data Retention Rules: Expire images older than 70 hours
    const expiryTime = new Date(Date.now() - 70 * 60 * 60 * 1000);
    let modified = false;

    for (let msg of doubt.messages) {
      if (msg.imageUrl && msg.imageUrl !== 'EXPIRED' && msg.timestamp <= expiryTime) {
         // Perform Cloudinary deletion if it's a cloudinary URL
         if (msg.imageUrl.includes('cloudinary.com')) {
           try {
             const urlObj = new URL(msg.imageUrl);
             const parts = urlObj.pathname.split('/');
             const uploadIndex = parts.findIndex(p => p === 'upload');
             if (uploadIndex !== -1) {
                 const publicIdWithExt = parts.slice(uploadIndex + 2).join('/');
                 const fullPublicId = publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf('.'));
                 const { cloudinary } = require('../utils/cloudinaryHelper');
                 await cloudinary.uploader.destroy(fullPublicId);
             }
           } catch(e) { console.error('Cloudinary cleanup error (student):', e); }
         }
         msg.imageUrl = 'EXPIRED';
         modified = true;
      }
    }

    if (modified) {
      await doubt.save();
    }

    // Mark as read by student
    if (doubt.unreadByStudent) {
      doubt.unreadByStudent = false;
      await doubt.save();
    }

    return success(res, 'Messages fetched', {
      doubtId: id,
      subject: doubt.subject,
      status: doubt.status,
      messages: doubt.messages
    });
  } catch (err) {
    console.error('getDoubtMessages error:', err);
    return error(res, 'Failed to fetch messages', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 17. POST /api/student/doubts/:id/messages
// ══════════════════════════════════════════════════════════════════════════════
const sendDoubtMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, imageUrl } = req.body;
    const studentId = req.user.googleUid;

    if (!content || content.trim().length < 2) {
      return error(res, 'Message must be at least 2 characters', 'TOO_SHORT', 400);
    }

    const doubt = await Doubt.findById(id);
    if (!doubt) return error(res, 'Doubt not found', 'NOT_FOUND', 404);
    if (doubt.studentId !== studentId) return error(res, 'Access denied', 'FORBIDDEN', 403);
    if (doubt.status === 'resolved') {
      return error(res, 'This doubt is already resolved', 'ALREADY_RESOLVED', 400);
    }

    const message = {
      messageId: crypto.randomUUID(),
      senderRole: 'student',
      content: content.trim(),
      imageUrl: imageUrl || null,
      timestamp: new Date()
    };

    doubt.messages.push(message);
    doubt.unreadByTeacher = true;
    doubt.lastReplyAt = new Date();
    await doubt.save();

    return success(res, 'Message sent', {
      doubtId: doubt._id,
      message,
      totalMessages: doubt.messages.length
    });
  } catch (err) {
    console.error('sendDoubtMessage error:', err);
    return error(res, 'Failed to send message', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 18. GET /api/student/bookmarks
// ══════════════════════════════════════════════════════════════════════════════
const getBookmarks = async (req, res) => {
  try {
    const studentId = req.user.googleUid;
    const _q = Question.modelName;

    const bookmarks = await Bookmark.find({ studentId })
      .sort({ createdAt: -1 })
      .populate('questionId', 'difficulty marks tags questionType')
      .lean();

    return success(res, 'Bookmarks fetched', {
      bookmarks: bookmarks.map(b => ({
        bookmarkId: b._id,
        questionId: b.questionId?._id || b.questionId,
        questionText: b.questionText,
        subject: b.subject,
        chapterName: b.chapterName,
        difficulty: b.questionId?.difficulty,
        marks: b.questionId?.marks,
        tags: b.questionId?.tags,
        questionType: b.questionId?.questionType,
        bookmarkedAt: b.createdAt
      }))
    });
  } catch (err) {
    console.error('getBookmarks error:', err);
    return error(res, 'Failed to fetch bookmarks', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 19. POST /api/student/bookmarks
// ══════════════════════════════════════════════════════════════════════════════
const addBookmark = async (req, res) => {
  try {
    const { questionId } = req.body;
    const studentId = req.user.googleUid;

    if (!questionId) return error(res, 'questionId is required', 'MISSING_FIELD', 400);

    const question = await Question.findById(questionId);
    if (!question) return error(res, 'Question not found', 'NOT_FOUND', 404);

    // Verify student has access to the bank this question belongs to
    const bank = await Bank.findById(question.bankId).select('approvedStudents');
    if (!bank || !bank.approvedStudents.includes(studentId)) {
      return error(res, 'You do not have access to this question', 'FORBIDDEN', 403);
    }

    // Check duplicate
    const existing = await Bookmark.findOne({ studentId, questionId });
    if (existing) return error(res, 'Question already bookmarked', 'ALREADY_BOOKMARKED', 409);

    const bookmark = await Bookmark.create({
      studentId,
      questionId,
      questionText: question.questionText,
      subject: question.subject,
      chapterName: question.chapterName
    });

    return success(res, 'Bookmark added', {
      bookmarkId: bookmark._id,
      questionText: question.questionText.substring(0, 80)
    }, 201);
  } catch (err) {
    console.error('addBookmark error:', err);
    return error(res, 'Failed to add bookmark', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 20. DELETE /api/student/bookmarks/:questionId
// ══════════════════════════════════════════════════════════════════════════════
const deleteBookmark = async (req, res) => {
  try {
    const { questionId } = req.params;
    const studentId = req.user.googleUid;

    const result = await Bookmark.findOneAndDelete({ studentId, questionId });
    if (!result) return error(res, 'Bookmark not found', 'NOT_FOUND', 404);

    return success(res, 'Bookmark removed', null);
  } catch (err) {
    console.error('deleteBookmark error:', err);
    return error(res, 'Failed to remove bookmark', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 21. GET /api/student/streak
// ══════════════════════════════════════════════════════════════════════════════
const getStreak = async (req, res) => {
  try {
    const streak = await syncStreak(req.user.googleUid);

    return success(res, 'Streak data fetched', {
      currentStreak: streak?.currentStreak || 0,
      bestStreak: streak?.bestStreak || 0,
      lastActiveDate: streak?.lastActiveDate || null,
      totalActiveDays: streak?.totalActiveDays || 0,
      weeklyActivity: streak?.weeklyActivity || [false, false, false, false, false, false, false]
    });
  } catch (err) {
    console.error('getStreak error:', err);
    return error(res, 'Failed to fetch streak', 'SERVER_ERROR', 500);
  }
};

const updateStreakActivity = async (req, res) => {
  try {
    const studentId = req.user.googleUid;
    const streak = await updateStreak(studentId);
    
    // Log activity
    await logActivity(
      studentId, 
      'practice_paper_download', 
      'Paper Downloaded', 
      'Student downloaded/printed a practice paper', 
      '#FF4500'
    );

    return success(res, 'Streak updated successfully', {
      currentStreak: streak.currentStreak,
      bestStreak: streak.bestStreak
    });
  } catch (err) {
    console.error('updateStreakActivity error:', err);
    return error(res, 'Failed to update streak', 'SERVER_ERROR', 500);
  }
};

module.exports = {
  getDashboard,
  getProfile,
  updateProfile,
  searchBank,
  requestAccess,
  getMyBanks,
  deleteBank,
  verifyOTP,
  getBankChapters,
  getNotes,
  generateTest,
  submitTest,
  getTestHistory,
  getDoubts,
  submitDoubt,
  getDoubtMessages,
  sendDoubtMessage,
  getBookmarks,
  addBookmark,
  deleteBookmark,
  getStreak,
  updateStreakActivity
};
