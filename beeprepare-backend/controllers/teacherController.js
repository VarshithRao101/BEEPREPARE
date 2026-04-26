const multer = require('multer');
const { connectDB } = require('../config/db');
const crypto = require('crypto');
const { admin, db, bucket } = require('../config/firebase');
const User = require('../models/User');
const Bank = require('../models/Bank');
const Note = require('../models/Note');
const Question = require('../models/Question');
const AccessRequest = require('../models/AccessRequest');
const Doubt = require('../models/Doubt');
const ActivityLog = require('../models/ActivityLog');
const generateSyncCode = require('../utils/generateSyncCode');
const generateOTP = require('../utils/generateOTP');
const { success, error } = require('../utils/responseHelper');
const { cloudinary, generatePdfUrl } = require('../utils/cloudinaryHelper');
const fs = require('fs');
const path = require('path');
const os = require('os');
const getChapterId = require('../utils/getChapterId');


// ─── Multer Setup (memory storage — buffer uploaded to Firebase) ───────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB hard cap for the buffer
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF, JPG, JPEG, PNG files are allowed'), false);
  }
});

// ─── Shuffle Helper ────────────────────────────────────────────────────────
const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ─── Activity Log Writer ───────────────────────────────────────────────────
const logActivity = async (userId, type, title, description, color = '#FFD700') => {
  try {
    await ActivityLog.create({ userId, type, title, description, color });
  } catch (e) {
    console.error('ActivityLog write failed:', e.message);
  }
};

// ─── Firebase Storage Delete Helper ───────────────────────────────────────
// ─── Cloudinary/Storage Delete Helper ───────────────────────────────────────
const deleteFromStorage = async (identifier, resource_type = 'raw') => {
  if (!identifier) return;
  try {
    // If it's a Cloudinary public_id (doesn't contain http/https) or we explicitly pass resource_type
    if (!identifier.startsWith('http')) {
      await cloudinary.uploader.destroy(identifier, { resource_type: resource_type });
      return;
    }

    // Legacy Firebase URL cleanup
    const url = new URL(identifier);
    const pathMatch = url.pathname.match(/\/o\/(.+)/);
    if (pathMatch) {
      const filePath = decodeURIComponent(pathMatch[1]);
      await bucket.file(filePath).delete();
    }
  } catch (e) {
    console.warn(`Storage delete failed for ${identifier}: ${e.message}`);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 1. GET /api/teacher/dashboard
// ══════════════════════════════════════════════════════════════════════════════
const getDashboard = async (req, res) => {
  try {
    await connectDB();
    const teacherId = req.user.googleUid;

    console.log(`[DASHBOARD] Fetching data for teacher ${teacherId}...`);
    const [banks, activityLogs, pendingDoubtsCount, pendingRequestsCount] = await Promise.all([
      Bank.find({ teacherId }).select('subject class bankCode totalQuestions notesCount chapters isActive').lean(),
      ActivityLog.find({ userId: teacherId }).sort({ createdAt: -1 }).limit(10).lean(),
      Doubt.countDocuments({ teacherId, unreadByTeacher: true }),
      AccessRequest.countDocuments({ teacherId, status: 'pending' })
    ]);
    console.log(`[DASHBOARD] DB Queries complete for ${teacherId}`);

    const user = req.user;
    // Self-healing: Recalculate unique subjects count for stats
    const uniqueUsed = [...new Set(banks.map(b => b.subject))];
    const totalQuestionsSum = banks.reduce((sum, b) => sum + (b.totalQuestions || 0), 0);

    // If mongo counts drifted, sync them now
    if (user.totalQuestions !== totalQuestionsSum) {
      await User.updateOne({ googleUid: teacherId }, { totalQuestions: totalQuestionsSum });
    }

    return success(res, 'Dashboard data fetched', {
      subjects: banks.map(b => ({
        bankId: b._id,
        subject: b.subject,
        class: b.class, // Keep full name for frontend consistency (e.g. "Class 10")
        bankCode: b.bankCode,
        totalQuestions: b.totalQuestions,
        notesCount: b.notesCount,
        chapterCount: b.chapters?.length || 0,
        isActive: b.isActive
      })),
      stats: {
        totalQuestions: totalQuestionsSum,
        activeStudents: user.activeStudents || 0,
        subjectsUsed: uniqueUsed.length,
        subjectLimit: user.subjectLimit || 1,
        planType: user.planType
      },
      userSubjects: user.subjects || [],
      userClasses: user.classes || [],
      needsSetup: (user.subjects || []).length === 0,
      activityLog: activityLogs,
      pendingDoubtsCount,
      pendingRequestsCount
    });
  } catch (err) {
    console.error('getDashboard error:', err);
    return error(res, 'Failed to fetch dashboard', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 2. GET /api/teacher/profile
// ══════════════════════════════════════════════════════════════════════════════
const getProfile = async (req, res) => {
  try {
    await connectDB();
    const teacherId = req.user.googleUid;
    const user = req.user;

    let totalNotes = 0;
    try {
      totalNotes = await Note.countDocuments({ teacherId });
    } catch (e) {
      console.warn('Note count failed in getProfile:', e.message);
    }

    console.log(`[PROFILE] Fetching data for teacher ${teacherId}...`);
    
    // Self-healing: Assign beeId if missing
    if (!user.beeId) {
        const generateBeeId = () => {
            const chars = '0123456789';
            let num = '';
            for (let i = 0; i < 4; i++) num += chars[Math.floor(Math.random() * chars.length)];
            return `TEA-${num}`;
        };
        let newId;
        let attempts = 0;
        do {
            newId = generateBeeId();
            const exists = await User.findOne({ beeId: newId });
            if (!exists) break;
            attempts++;
        } while (attempts < 10);
        
        await User.updateOne({ googleUid: teacherId }, { beeId: newId });
        user.beeId = newId;
    }

    // Split queries to handle Cluster 1 (Questions) and Cluster 2 (App Data) separately
    const banksPromise = Bank.find({ teacherId }).lean();
    const activityPromise = ActivityLog.countDocuments({ userId: teacherId, type: 'paper_generated' });
    
    // Cluster 1 can be slow or unstable — wrap in 5s timeout and fallback to user.totalQuestions
    const questionCountPromise = Promise.race([
      Question.countDocuments({ createdBy: teacherId }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('CLUSTER_1_TIMEOUT')), 5000))
    ]).catch(err => {
      console.warn(`[PROFILE_SYNC] Question count failed for ${teacherId}: ${err.message}`);
      return user.totalQuestions || 0;
    });

    const [banks, totalQuestions, papersGenerated] = await Promise.all([
      banksPromise,
      questionCountPromise,
      activityPromise
    ]);
    console.log(`[PROFILE] DB Queries complete: ${banks.length} banks, ${totalQuestions} questions.`);

    // ── Self-Healing: Sync subjects/classes/chapters from Banks if User doc is drifted ────
    const bankSubjects = [...new Set(banks.map(b => b.subject))];
    const bankClasses = [...new Set(banks.map(b => b.class))];
    
    // Map existing bank chapters back to the user's chapter template
    const bankChaptersMap = {};
    banks.forEach(b => {
      const key = `${b.class}-${b.subject}`;
      bankChaptersMap[key] = b.chapters.map(c => c.chapterName);
    });

    let needsUserUpdate = false;
    const updateOps = {};

    if (JSON.stringify(user.subjects || []) !== JSON.stringify(bankSubjects)) {
      updateOps.subjects = bankSubjects;
      needsUserUpdate = true;
    }
    if (JSON.stringify(user.classes || []) !== JSON.stringify(bankClasses)) {
      updateOps.classes = bankClasses;
      needsUserUpdate = true;
    }
    // Deep compare chapters map
    if (JSON.stringify(user.chapters || {}) !== JSON.stringify(bankChaptersMap)) {
      updateOps.chapters = bankChaptersMap;
      needsUserUpdate = true;
    }

    if (needsUserUpdate) {
      console.log(`[PROFILE] Syncing drifted user state (subjects/classes/chapters) for ${teacherId}`);
      await User.updateOne({ googleUid: teacherId }, { $set: updateOps });
      user.subjects = bankSubjects;
      user.classes = bankClasses;
      user.chapters = bankChaptersMap;
    }

    console.log(`[PROFILE] Returning success for ${teacherId}`);
    return success(res, 'Profile fetched', {
      googleUid: user.googleUid,
      email: user.email,
      displayName: user.displayName,
      photoUrl: user.photoUrl,
      phone: user.phone,
      role: user.role,
      beeId: user.beeId,
      nameChanged: user.nameChanged,
      planType: user.planType,
      subjectLimit: user.subjectLimit,
      isActivated: user.isActivated,
      aiMessagesToday: user.aiMessagesToday || 0,
      licenseActivatedAt: user.licenseActivatedAt,
      licenseExpiresAt: user.licenseExpiresAt,
      subjects: user.subjects || [],
      classes: user.classes || [],
      chapters: user.chapters || {},
      stats: {
        totalQuestions,
        totalNotes,
        papersGenerated,
        activeStudents: user.activeStudents || 0,
        totalPapers: papersGenerated // Legacy name
      },
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt
    });
  } catch (err) {
    console.error('getProfile error:', err);
    return error(res, 'Failed to fetch profile', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 3. PUT /api/teacher/profile
// ══════════════════════════════════════════════════════════════════════════════
const updateProfile = async (req, res) => {
  try {
    const { displayName, phone, subjects, classes, chapters } = req.body;
    const teacherId = req.user.googleUid;
    const user = req.user;
    const updates = {};

    if (displayName !== undefined && displayName.trim() !== user.displayName) {
      if (user.nameChanged) {
        return error(res, 'Name can only be changed once. Action locked.', 'NAME_LOCKED', 403);
      }
      if (typeof displayName !== 'string' || displayName.trim().length < 2) {
        return error(res, 'Display name must be at least 2 characters', 'INVALID_NAME', 400);
      }
      updates.displayName = displayName.trim();
      updates.nameChanged = true;
    }

    if (phone !== undefined) {
      updates.phone = phone;
    }

    if (subjects !== undefined) {
      let subjectsArray = subjects;
      if (subjects && typeof subjects === 'object' && !Array.isArray(subjects)) {
        subjectsArray = Object.values(subjects);
        console.log(`[FIX] Converted object-like subjects to array for ${teacherId}`);
      }
      if (!Array.isArray(subjectsArray)) {
        console.warn(`[updateProfile] Invalid subjects format from user ${teacherId}:`, subjects);
        return error(res, 'Subjects must be an array', 'INVALID_SUBJECTS', 400);
      }
      if (subjectsArray.length > (req.user.subjectLimit || 1)) {
        return error(res, `Subject limit reached (${req.user.subjectLimit || 1}). ✨ Activate your account to manage more subjects and expand your academic reach!`, 'LIMIT_EXCEEDED', 403);
      }
      const validSubjects = ['Physics', 'Chemistry', 'Mathematics', 'Maths', 'Biology', 'English', 'Telugu', 'Hindi', 'Social', 'Social Studies', 'Science', 'EVS', 'Computer', 'History', 'Geography'];
      if (!subjectsArray.every(s => validSubjects.includes(s))) {
        return error(res, 'One or more invalid subjects selected', 'INVALID_SUBJECT', 400);
      }
      updates.subjects = subjectsArray;
    }

    if (classes !== undefined) {
      let classesArray = classes;
      if (classes && typeof classes === 'object' && !Array.isArray(classes)) {
        classesArray = Object.values(classes);
      }
      if (!Array.isArray(classesArray)) {
        return error(res, 'Classes must be an array', 'INVALID_CLASSES', 400);
      }
      const validClasses = ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'];
      if (!classesArray.every(c => validClasses.includes(c))) {
        return error(res, 'One or more invalid classes selected', 'INVALID_CLASS', 400);
      }
      updates.classes = classesArray;
    }

    if (chapters !== undefined) {
      if (typeof chapters !== 'object' || Array.isArray(chapters)) {
        return error(res, 'Chapters must be an object map', 'INVALID_CHAPTERS', 400);
      }
      updates.chapters = chapters;
    }

    if (Object.keys(updates).length === 0) {
      return error(res, 'No valid fields to update', 'NO_UPDATES', 400);
    }

    // Save user profile
    await User.updateOne({ googleUid: teacherId }, updates);

    // ── Auto-sync Banks & Chapters (Parallelized for Speed) ──────────────────
    // 1. Sanitize and Deduplicate Inputs
    const rawSubjects = updates.subjects || user.subjects || [];
    const rawClasses  = updates.classes  || user.classes  || [];
    
    // Ensure they are arrays of strings and unique
    const finalSubjects = [...new Set(
      (Array.isArray(rawSubjects) ? rawSubjects : [])
        .filter(s => typeof s === 'string' && s.trim().length > 0)
    )];
    const finalClasses = [...new Set(
      (Array.isArray(rawClasses) ? rawClasses : [])
        .filter(c => typeof c === 'string' && c.trim().length > 0)
    )];
    const finalChapters = updates.chapters || user.chapters || {};

    if (updates.subjects !== undefined || updates.classes !== undefined || updates.chapters !== undefined || updates.displayName !== undefined || updates.phone !== undefined) {
      const existingBanks = await Bank.find({ teacherId });

      // 1. Concurrent Deletion (Cascading cleanup for orphaned subjects OR orphaned classes)
      // We delete a bank if its subject is removed OR its class is removed
      const banksToDelete = existingBanks.filter(b => 
        !finalSubjects.includes(b.subject) || !finalClasses.includes(b.class)
      );
      
      const deleteOps = banksToDelete.map(async (bank) => {
        try {
          const notes = await Note.find({ bankId: bank._id }).lean();
          
          // Cascading storage cleanup
          notes.forEach(note => {
            if (note.fileUrl) deleteFromStorage(note.fileUrl);
          });

          return Promise.all([
            Question.deleteMany({ bankId: String(bank._id) }),
            Note.deleteMany({ bankId: bank._id }),
            AccessRequest.deleteMany({ bankId: bank._id }),
            Bank.findByIdAndDelete(bank._id),
            logActivity(teacherId, 'bank_deleted', 'Bank Destroyed', 
              `The ${bank.subject} bank for ${bank.class} was permanently removed.`, '#FF4D4D')
          ]);
        } catch (delErr) {
          console.error(`Failed to delete bank ${bank._id}:`, delErr);
          throw delErr;
        }
      });

      // 2. Synchronization (Update existing or Create new)
      const teacherName = updates.displayName || user.displayName;
      const syncOps = [];

      for (const className of finalClasses) {
        for (const subject of finalSubjects) {
          const normalizedClass = className.startsWith('Class ') ? className : `Class ${className}`;
          
          // Check if bank already exists in our snapshot
          let bank = existingBanks.find(b => b.subject === subject && b.class === normalizedClass);
          
          // Skip if this bank is scheduled for deletion
          if (bank && banksToDelete.some(b => b._id.toString() === bank._id.toString())) {
            continue; 
          }

          const chapterKey = `${normalizedClass}-${subject}`;
          const rawChapterList = finalChapters[chapterKey] || [];
          
          // Map chapters while preserving questionCount if the chapter already exists in the bank
          // Defensive: Handle both string arrays and object arrays from various sync states
          if (!Array.isArray(rawChapterList)) {
            console.warn(`Chapters for ${chapterKey} is not an array. Skipping sync for this combination.`);
            continue;
          }

          const syncChapters = rawChapterList.map((c, idx) => {
            const cName = typeof c === 'string' ? c : (c?.chapterName || '');
            if (!cName || cName.trim().length === 0) return null;

            const chapterId = getChapterId(normalizedClass, subject, cName);
            const existingChapter = bank?.chapters?.find(ch => ch.chapterId === chapterId);
            
            return {
              chapterId,
              chapterName: cName.trim(),
              order: idx + 1,
              questionCount: existingChapter ? (existingChapter.questionCount || 0) : 0
            };
          }).filter(Boolean);

          if (!bank) {
            syncOps.push((async () => {
              const bankCode = await generateSyncCode();
              await Bank.create({
                teacherId,
                teacherName,
                subject,
                class: normalizedClass,
                chapters: syncChapters,
                bankCode,
                approvedStudents: [],
                totalQuestions: 0,
                notesCount: 0,
                isActive: true
              });

              return logActivity(teacherId, 'bank_created', 'Bank Initialized', 
                `Automated sync engine established a new ${subject} terminal for ${normalizedClass}.`, '#4CAF50');
            })());
          } else {
            // Update existing bank with new chapters and potential name change
            syncOps.push(Bank.updateOne(
              { _id: bank._id },
              { 
                chapters: syncChapters,
                teacherName,
                isActive: true
              }
            ));
          }
        }
      }

      await Promise.all([...deleteOps, ...syncOps]);
    }
    // ── End Bank Sync ───────────────────────────────────────────────────────

    return success(res, 'Profile and subject banks synchronized.', {
      ...user,
      ...updates,
      subjects: finalSubjects,
      classes: finalClasses,
      chapters: finalChapters
    });

  } catch (err) {
    console.error('updateProfile error:', err);
    return error(res, `Failed to update profile: ${err.message}`, 'SERVER_ERROR', 500);
  }
};



// ══════════════════════════════════════════════════════════════════════════════
// 4. POST /api/teacher/subjects
// ══════════════════════════════════════════════════════════════════════════════
const addSubject = async (req, res) => {
  try {
    const { subject, class: className } = req.body;
    const teacherId = req.user.googleUid;

    if (!subject || !className) {
      return error(res, 'Subject and class are required', 'MISSING_FIELDS', 400);
    }

    const validSubjects = ['Physics', 'Chemistry', 'Mathematics', 'Maths', 'Biology', 'English', 'Telugu', 'Hindi', 'Social', 'Social Studies', 'Science', 'EVS', 'Computer', 'History', 'Geography'];
    const validClasses = ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'];

    if (!validSubjects.includes(subject)) {
      return error(res, 'Invalid subject', 'INVALID_SUBJECT', 400);
    }
    // Normalize class name for consistency
    const normalizedClass = className.startsWith('Class ') ? className : `Class ${className}`;
    if (!validClasses.includes(normalizedClass)) {
      return error(res, 'Invalid class. Must be Class 7, 8, 9, or 10', 'INVALID_CLASS', 400);
    }

    // NEW LOGIC: Strictly enforce pre-selected subjects from profile (if any)
    if (req.user.subjects && req.user.subjects.length > 0) {
      if (!req.user.subjects.includes(subject)) {
        return error(res, `This subject is not in your selected list. Please update it in your profile first.`, 'SUBJECT_NOT_PRESELECTED', 403);
      }
    } else {
      // If none pre-selected, check unique subject count in Banks
      const existingBanks = await Bank.find({ teacherId });
      const uniqueUsed = [...new Set(existingBanks.map(b => b.subject))];
      
      if (!uniqueUsed.includes(subject) && uniqueUsed.length >= (req.user.subjectLimit || 1)) {
        return error(res, `Subject limit reached (${req.user.subjectLimit || 1}). ✨ Activate your account to create more subject banks and connect with more students!`, 'LIMIT_EXCEEDED', 403);
      }
    }

    // Check duplicate
    const existing = await Bank.findOne({ teacherId, subject, class: className });
    if (existing) {
      return error(res, `You already have a ${subject} bank for ${className}`, 'DUPLICATE_BANK', 409);
    }

    // Generate unique sync code
    const bankCode = await generateSyncCode();

    // Create bank
    const bank = await Bank.create({
      teacherId,
      teacherName: req.user.displayName,
      subject,
      class: className,
      chapters: [],
      bankCode,
      approvedStudents: [],
      totalQuestions: 0,
      notesCount: 0,
      isActive: true
    });

    // Update user subjects/classes arrays (avoid duplicates)
    await User.updateOne(
      { googleUid: teacherId },
      {
        $addToSet: { subjects: subject, classes: className }
      }
    );

    await logActivity(
      teacherId,
      'question_added',
      'Subject Bank Created',
      `Created ${subject} bank for ${className} (Code: ${bankCode})`,
      '#FFD700'
    );

    return success(res, 'Subject bank created successfully', {
      bankId: bank._id,
      bankCode: bank.bankCode,
      subject: bank.subject,
      class: bank.class
    }, 201);
  } catch (err) {
    console.error('addSubject error:', err);
    return error(res, 'Failed to create subject bank', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 5. DELETE /api/teacher/subjects/:bankId
// ══════════════════════════════════════════════════════════════════════════════
const deleteSubject = async (req, res) => {
  try {
    const { bankId } = req.params;
    const teacherId = req.user.googleUid;

    const bank = await Bank.findById(bankId);
    if (!bank) return error(res, 'Bank not found', 'BANK_NOT_FOUND', 404);
    if (bank.teacherId !== teacherId) return error(res, 'Access denied', 'FORBIDDEN', 403);

    // Delete all notes files from Firebase Storage
    const notes = await Note.find({ bankId });
    for (const note of notes) {
      if (note.fileUrl) await deleteFromStorage(note.fileUrl);
    }

    // Delete all related MongoDB documents in parallel
    await Promise.all([
      Question.deleteMany({ bankId: String(bankId) }), // String — cross-DB safe
      Note.deleteMany({ bankId }),
      AccessRequest.deleteMany({ bankId })
    ]);

    // Delete bank
    await Bank.findByIdAndDelete(bankId);

    // Remove subject/class from user if no other banks use them
    const remainingBanks = await Bank.find({ teacherId });
    const usedSubjects = [...new Set(remainingBanks.map(b => b.subject))];
    const usedClasses = [...new Set(remainingBanks.map(b => b.class))];

    await User.updateOne(
      { googleUid: teacherId },
      { subjects: usedSubjects, classes: usedClasses }
    );

    await logActivity(
      teacherId,
      'question_added',
      'Subject Bank Deleted',
      `Deleted ${bank.subject} bank for ${bank.class}`,
      '#FF4444'
    );

    return success(res, 'Subject bank and all its data deleted successfully', null);
  } catch (err) {
    console.error('deleteSubject error:', err);
    return error(res, 'Failed to delete subject bank', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 6. GET /api/teacher/chapters/:bankId
// ══════════════════════════════════════════════════════════════════════════════
const getChapters = async (req, res) => {
  try {
    const { bankId } = req.params;
    const teacherId = req.user.googleUid;

    const bank = await Bank.findById(bankId).select('teacherId chapters subject class');
    if (!bank) return error(res, 'Bank not found', 'BANK_NOT_FOUND', 404);
    if (bank.teacherId !== teacherId) return error(res, 'Access denied', 'FORBIDDEN', 403);

    return success(res, 'Chapters fetched', {
      bankId,
      subject: bank.subject,
      class: bank.class,
      chapters: bank.chapters.sort((a, b) => a.order - b.order)
    });
  } catch (err) {
    console.error('getChapters error:', err);
    return error(res, 'Failed to fetch chapters', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 7. POST /api/teacher/chapters/:bankId
// ══════════════════════════════════════════════════════════════════════════════
const addChapter = async (req, res) => {
  try {
    const { bankId } = req.params;
    const { chapterName } = req.body;
    const teacherId = req.user.googleUid;

    if (!chapterName || chapterName.trim().length < 3) {
      return error(res, 'Chapter name must be at least 3 characters', 'INVALID_CHAPTER', 400);
    }

    const bank = await Bank.findById(bankId);
    if (!bank) return error(res, 'Bank not found', 'BANK_NOT_FOUND', 404);
    if (bank.teacherId !== teacherId) return error(res, 'Access denied', 'FORBIDDEN', 403);

    if (bank.chapters.length >= 30) {
      return error(res, 'Maximum 30 chapters allowed per bank', 'CHAPTER_LIMIT_REACHED', 422);
    }

    // Check for duplicate chapter name
    const dupChapter = bank.chapters.find(
      c => c.chapterName.toLowerCase() === chapterName.trim().toLowerCase()
    );
    if (dupChapter) {
      return error(res, 'A chapter with this name already exists', 'DUPLICATE_CHAPTER', 409);
    }

    const chapterId = getChapterId(bank.class, bank.subject, chapterName);

    const newChapter = {
      chapterId,
      chapterName: chapterName.trim(),
      order: bank.chapters.length + 1,
      questionCount: 0
    };

    bank.chapters.push(newChapter);
    await bank.save();

    return success(res, 'Chapter added successfully', {
      chapters: bank.chapters.sort((a, b) => a.order - b.order)
    }, 201);
  } catch (err) {
    console.error('addChapter error:', err);
    return error(res, 'Failed to add chapter', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 7b. DELETE /api/teacher/chapters/:bankId/:chapterId
// ══════════════════════════════════════════════════════════════════════════════
const deleteChapter = async (req, res) => {
  try {
    const { bankId, chapterId } = req.params;
    const teacherId = req.user.googleUid;

    const bank = await Bank.findById(bankId);
    if (!bank) return error(res, 'Bank not found', 'BANK_NOT_FOUND', 404);
    if (bank.teacherId !== teacherId) return error(res, 'Access denied', 'FORBIDDEN', 403);

    const chapterIndex = bank.chapters.findIndex(c => c.chapterId === chapterId);
    if (chapterIndex === -1) return error(res, 'Chapter not found', 'CHAPTER_NOT_FOUND', 404);

    const chapter = bank.chapters[chapterIndex];
    const chapterName = chapter.chapterName;

    // 1. Remove from Bank
    bank.chapters.splice(chapterIndex, 1);
    await bank.save();

    // 2. Remove questions and notes in parallel
    const notes = await Note.find({ bankId, chapterId }).lean();
    notes.forEach(note => { if (note.fileUrl) deleteFromStorage(note.fileUrl); });

    await Promise.all([
      Question.deleteMany({ bankId: String(bankId), chapterId }), // String — cross-DB safe
      Note.deleteMany({ bankId, chapterId })
    ]);

    // 3. Keep User profile in sync
    const normalizedClass = bank.class.startsWith('Class ') ? bank.class : `Class ${bank.class}`;
    const chapterKey = `${normalizedClass}-${bank.subject}`;
    
    const user = await User.findOne({ googleUid: teacherId });
    if (user && user.chapters && user.chapters[chapterKey]) {
      const updatedList = user.chapters[chapterKey].filter(c => c !== chapterName);
      const updates = {};
      updates[`chapters.${chapterKey}`] = updatedList;
      await User.updateOne({ googleUid: teacherId }, { $set: updates });
    }

    await logActivity(
      teacherId,
      'chapter_deleted',
      'Chapter Removed',
      `Deleted ${chapterName} from ${bank.subject} ${bank.class}`,
      '#FF4444'
    );

    return success(res, 'Chapter and all its data deleted successfully', {
      chapters: bank.chapters.sort((a, b) => a.order - b.order)
    });
  } catch (err) {
    console.error('deleteChapter error:', err);
    return error(res, 'Failed to delete chapter', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 8. GET /api/teacher/questions
// ══════════════════════════════════════════════════════════════════════════════
const getQuestions = async (req, res) => {
  try {
    const { bankId, chapterId, type, difficulty, page = 1, limit = 20 } = req.query;
    const teacherId = req.user.googleUid;

    if (!bankId) return error(res, 'bankId query param is required', 'MISSING_BANKID', 400);

    const bank = await Bank.findById(bankId).select('teacherId');
    if (!bank) return error(res, 'Bank not found', 'BANK_NOT_FOUND', 404);
    if (bank.teacherId !== teacherId) return error(res, 'Access denied', 'FORBIDDEN', 403);

    const filter = { bankId: String(bankId) }; // String — cross-DB safe (questions on Cluster 2)
    if (chapterId) filter.chapterId = chapterId;
    if (type) filter.questionType = type;
    if (difficulty) filter.difficulty = difficulty;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [questions, total] = await Promise.all([
      Question.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Question.countDocuments(filter)
    ]);

    return success(res, 'Questions fetched', {
      questions,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    console.error('getQuestions error:', err);
    return error(res, 'Failed to fetch questions', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 9. POST /api/teacher/questions
// ══════════════════════════════════════════════════════════════════════════════
const addQuestion = async (req, res) => {
  try {
    const {
      bankId, chapterId, chapterName,
      questionText, questionType, marks,
      difficulty, tags, mcqOptions, correctOption,
      imageUrl
    } = req.body;

    const teacherId = req.user.googleUid;
    const marksInt = parseInt(marks);

    // Specific field validation
    const missing = [];
    if (!bankId) missing.push('bankId');
    if (!chapterId) missing.push('chapterId');
    if (!questionText) missing.push('questionText');
    if (!questionType) missing.push('questionType');
    if (isNaN(marksInt)) missing.push('marks');
    if (!difficulty) missing.push('difficulty');

    if (missing.length > 0) {
      return error(res, `Missing or invalid required fields: ${missing.join(', ')}`, 'MISSING_FIELDS', 400);
    }

    // Normalize difficulty casing
    const normalizedDifficulty = difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();

    const validTypes = ['MCQ', 'Very Short', 'Short', 'Long', 'Essay'];
    if (!validTypes.includes(questionType)) {
      return error(res, `Invalid question type. Must be one of: ${validTypes.join(', ')}`, 'INVALID_TYPE', 400);
    }

    const validMarks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    if (!validMarks.includes(marksInt)) {
      return error(res, 'Marks must be between 1 and 10', 'INVALID_MARKS', 400);
    }

    if (questionText.length < 10 || questionText.length > 2000) {
      return error(res, 'Question text must be between 10 and 2000 characters', 'INVALID_LENGTH', 400);
    }

    // Validate bank ownership
    const bank = await Bank.findById(bankId);
    if (!bank) return error(res, 'Bank not found', 'BANK_NOT_FOUND', 404);
    if (bank.teacherId !== teacherId) return error(res, 'Access denied', 'FORBIDDEN', 403);

    // Validate chapter exists in bank
    const chapter = bank.chapters.find(c => c.chapterId === chapterId);
    if (!chapter) return error(res, 'Chapter not found in this bank', 'CHAPTER_NOT_FOUND', 404);

    // Limit max 100 questions per chapter to prevent MongoDB document bloat
    if (chapter.questionCount >= 100) {
      return error(res, 'Architecture limit reached. A single chapter node can hold a maximum of 100 questions. Please clear old data or create a new chapter.', 'LIMIT_REACHED', 400);
    }

    // MCQ validation
    if (questionType === 'MCQ') {
      if (!mcqOptions || !mcqOptions.A || !mcqOptions.B || !mcqOptions.C || !mcqOptions.D) {
        return error(res, 'MCQ questions require options A, B, C, and D', 'MCQ_OPTIONS_REQUIRED', 400);
      }
      if (!correctOption || !['A', 'B', 'C', 'D'].includes(correctOption)) {
        return error(res, 'MCQ questions require a correctOption (A, B, C, or D)', 'CORRECT_OPTION_REQUIRED', 400);
      }
    }

    // Determine isImportant
    const importantTags = ['Important', 'Repeated', 'Exam Focus'];
    const tagsArr = Array.isArray(tags) ? tags : [];
    const isImportant = tagsArr.some(t => importantTags.includes(t));

    // Handle Cloudinary Upload
    let finalImageUrl = null;
    let finalImagePublicId = null;

    if (imageUrl && imageUrl.startsWith('data:image')) {
      try {
        const { cloudinary } = require('../utils/cloudinaryHelper');
        const uploadRes = await cloudinary.uploader.upload(imageUrl, {
          folder: `questions/teacher_${teacherId}`,
          resource_type: 'image',
          format: 'webp',
          quality: 'auto'
        });
        finalImageUrl = uploadRes.secure_url;
        finalImagePublicId = uploadRes.public_id;
      } catch (uploadErr) {
        console.error('Cloudinary upload failure:', uploadErr);
        return error(res, 'Failed to process diagram attachment', 'UPLOAD_ERROR', 500);
      }
    }

    // Create optimized question — includes full hierarchy for Cluster 2 schema
    const question = await Question.create({
      // ── Hierarchy (new fields for Cluster 2 schema) ───────────────────────
      teacherId,
      class: bank.class,
      subject: bank.subject,
      chapterName: chapter.chapterName,
      // ── Question content ──────────────────────────────────────────────────
      questionText,
      questionType,
      marks: marksInt,
      difficulty: normalizedDifficulty,
      mcqOptions: questionType === 'MCQ' ? mcqOptions : undefined,
      correctOption: questionType === 'MCQ' ? correctOption : undefined,
      isImportant,
      tags: tagsArr,
      chapterId,
      imageUrl: finalImageUrl,
      imagePublicId: finalImagePublicId,
      createdBy: teacherId,
      bankId: String(bankId) // Store as String — cross-DB safe
    });

    // Increment counts atomically
    await Promise.all([
      Bank.updateOne(
        { _id: bankId },
        {
          $inc: {
            totalQuestions: 1,
            'chapters.$[ch].questionCount': 1
          }
        },
        { arrayFilters: [{ 'ch.chapterId': chapterId }] }
      ),
      User.updateOne({ googleUid: teacherId }, { $inc: { totalQuestions: 1 } })
    ]);

    await logActivity(
      teacherId,
      'question_added',
      'Question Added',
      `Added ${questionType} question to ${chapterName}`,
      '#4CAF50'
    );

    return success(res, 'Question added successfully', question, 201);
  } catch (err) {
    console.error('addQuestion error:', err);
    return error(res, 'Failed to add question', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 10. DELETE /api/teacher/questions/:id
// ══════════════════════════════════════════════════════════════════════════════
const deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const teacherId = req.user.googleUid;

    const question = await Question.findById(id);
    if (!question) return error(res, 'Question not found', 'NOT_FOUND', 404);

    const bank = await Bank.findById(question.bankId);
    if (!bank || bank.teacherId !== teacherId) return error(res, 'Access denied', 'FORBIDDEN', 403);

    if (question.imagePublicId) {
      try {
        const { cloudinary } = require('../utils/cloudinaryHelper');
        await cloudinary.uploader.destroy(question.imagePublicId);
      } catch (e) {
        console.error('Failed to delete question diagram', e);
      }
    }

    await Question.findByIdAndDelete(id);

    // Decrement counts
    await Promise.all([
      Bank.updateOne(
        { _id: question.bankId },
        {
          $inc: {
            totalQuestions: -1,
            'chapters.$[ch].questionCount': -1
          }
        },
        { arrayFilters: [{ 'ch.chapterId': question.chapterId }] }
      ),
      User.updateOne({ googleUid: teacherId }, { $inc: { totalQuestions: -1 } })
    ]);

    return success(res, 'Question deleted successfully', null);
  } catch (err) {
    console.error('deleteQuestion error:', err);
    return error(res, 'Failed to delete question', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 11. POST /api/teacher/generate-paper  (70/30 Algorithm)
// ══════════════════════════════════════════════════════════════════════════════
const generatePaper = async (req, res) => {
  try {
    let { bankId, selectedChapters, blueprint, layout } = req.body;
    const teacherId = req.user.googleUid;
    const paperId = crypto.randomUUID();

    // Safety: Convert object-wrapped arrays back to clean arrays if needed (fixes CastError)
    if (selectedChapters && typeof selectedChapters === 'object' && !Array.isArray(selectedChapters)) {
      selectedChapters = Object.values(selectedChapters);
    }
    if (blueprint && typeof blueprint === 'object' && !Array.isArray(blueprint)) {
      blueprint = Object.values(blueprint);
    }

    if (!bankId || !selectedChapters || !blueprint) {
      return error(res, 'bankId, selectedChapters, and blueprint are required', 'MISSING_FIELDS', 400);
    }

    // Step 1: Verify bank
    const bank = await Bank.findById(bankId);
    if (!bank) return error(res, 'Bank not found', 'BANK_NOT_FOUND', 404);
    if (bank.teacherId !== teacherId) return error(res, 'Access denied', 'FORBIDDEN', 403);

    // Step 2: Query all questions from selected chapters
    const allQuestions = await Question.find({
      bankId: String(bankId), // String — cross-DB safe (questions on Cluster 2)
      chapterId: { $in: selectedChapters }
    });

    // Step 3: Group into type pools
    const pools = {
      MCQ: { key: 'mcq', questions: [] },
      'Very Short': { key: 'veryShort', questions: [] },
      Short: { key: 'short', questions: [] },
      Long: { key: 'long', questions: [] },
      Essay: { key: 'essay', questions: [] }
    };

    for (const q of allQuestions) {
      if (pools[q.questionType]) pools[q.questionType].questions.push(q);
    }

    // Step 4: 70/30 selection per pool with dynamic marks from user blueprint
    const selected = [];
    const sectionDefs = [];
    const labels = ['A', 'B', 'C', 'D', 'E', 'F'];

    // blueprint is now an array: [{ id: 'mcq', type: 'MCQ', marks: 1, qty: 5 }, ...]
    blueprint.forEach((sectionReq, idx) => {
      const typeName = sectionReq.type;
      const blueprintKey = sectionReq.id;
      const needed = parseInt(sectionReq.qty) || 0;
      const requestedMarks = parseInt(sectionReq.marks) || 1;

      if (needed === 0) return;

      // Find identifying pool for this question type
      let foundPool = null;
      for (const poolEntry of Object.values(pools)) {
        if (poolEntry.key === blueprintKey) {
          foundPool = poolEntry;
          break;
        }
      }

      if (!foundPool || foundPool.questions.length === 0) return;

      const importantPool = foundPool.questions.filter(q => q.isImportant);
      const normalPool = foundPool.questions.filter(q => !q.isImportant);

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

      // IMPORTANT: Override marks based on user's architectural requirement for this paper
      typeSelected = typeSelected.map(q => {
        const qObj = q.toObject ? q.toObject() : { ...q };
        return {
          ...qObj,
          marks: requestedMarks // Apply user's requested marks
        };
      });

      if (typeSelected.length > 0) {
        selected.push(...typeSelected);

        // Add to our dynamic layout
        sectionDefs.push({
          label: labels[sectionDefs.length] || String.fromCharCode(65 + sectionDefs.length),
          type: typeName,
          key: blueprintKey,
          marksEach: requestedMarks,
          count: typeSelected.length,
          total: typeSelected.length * requestedMarks,
          questions: typeSelected // Store questions directly to avoid filter bugs
        });
      }
    });

    // Step 5 & 6: Calculate total marks based on ACTUAL selected questions and user requested marks
    const totalMarks = selected.reduce((sum, q) => sum + (q.marks || 0), 0);

    // Step 8: Construct REAL PROFESSIONAL paperHtml (Optimized for Scaling)
    let paperHtml = `
<div class="paper-header" style="font-size: inherit;">
  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5em;">
    <div style="text-align: left;">
      <span style="font-weight: bold; border-bottom: 1px solid #000; padding: 2px 10px;">Roll No: _____________</span>
    </div>
    <div style="text-align: right; font-size: 0.8em; color: #666;">
      Code No: BP-${paperId.substring(0, 6).toUpperCase()}
    </div>
  </div>

  <h2 style="margin: 0; font-size: 1.5em; text-align: center;">BOARD OF ACADEMIC EXCELLENCE (BEEPREPARE)</h2>
  <h3 style="margin: 5px 0 1em 0; font-size: 1.2em; text-transform: uppercase; text-align: center;">ANNUAL EXAMINATION (2025–26)</h3>
  <h4 style="margin: 0; font-size: 1.3em; border-bottom: 2px solid #000; padding-bottom: 0.8em; text-align: center;">
    SUBJECT: ${bank.subject.toUpperCase()} (CLASS: ${bank.class})
  </h4>

  <div class="paper-meta-row" style="display: flex; justify-content: space-between; margin-top: 1em; font-weight: bold; font-size: 1em;">
    <span>Maximum Time: 3 Hours</span>
    <span>Maximum Marks: ${totalMarks}</span>
  </div>
</div>

<div style="margin: 1.5em 0; border: 1px solid #000; padding: 1em; font-size: 0.9em; line-height: 1.6;">
  <strong>GENERAL INSTRUCTIONS:</strong>
  <ol style="margin: 0.5em 0 0 1.5em; padding: 0;">
    <li>This question paper contains ${selected.length} questions in ${sectionDefs.length} sections.</li>
    ${sectionDefs[0]?.type === 'MCQ' ? '<li>Section A consists of multiple-choice questions of 1 mark each.</li>' : ''}
    <li>Sections ${sectionDefs.length > 1 ? sectionDefs.slice(1).map(s => s.label).join(', ') : 'B, C, D'} contain questions of different weightage based on the provided blueprint.</li>
    <li>All questions are compulsory. However, internal choice is provided in some questions.</li>
    <li>Use of calculators is strictly prohibited.</li>
  </ol>
</div>`;

    let qNumber = 1;

    for (const section of sectionDefs) {
      const sectionQs = section.questions;
      if (sectionQs.length === 0) continue;

      const marksEach = section.marksEach || 1;

      paperHtml += `
      <div style="text-align: center; font-weight: bold; text-transform: uppercase; padding: 0.5em; background: #f2f2f2; border: 1px solid #ccc; margin: 2em 0 1em 0; font-size: 1.1em;">
        SECTION - ${section.label}
      </div>
      <div style="text-align: right; font-style: italic; font-size: 0.9em; margin-bottom: 0.8em;">
        (${sectionQs.length} questions × ${marksEach} mark${marksEach > 1 ? 's' : ''} each)
      </div>`;

      for (const q of sectionQs) {
        paperHtml += `
        <div class="question-item" style="margin-bottom: 1.2em; position: relative;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="flex: 1; padding-right: 2.5em;">
              <strong>Q${qNumber}.</strong> ${q.questionText}
            </div>
            <div style="font-weight: bold; min-width: 2em; text-align: right;">
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

        if (q.imageUrl) {
          paperHtml += `
          <div style="margin: 1em 0 0 2.5em; text-align: left;">
            <img src="${q.imageUrl}" alt="Diagram" style="max-width: 100%; max-height: 250px; border-radius: 6px; border: 1px solid #ccc;">
          </div>`;
        }

        paperHtml += `
          <div class="q-actions" style="position: absolute; right: -2.5em; top: 0; display: none;">
            <div class="action-icon" title="Replace Question">↻</div>
            <div class="action-icon" title="Delete">×</div>
          </div>
        </div>`;
        qNumber++;
      }
    }

    // Step 9: Log activity
    await logActivity(
      teacherId,
      'paper_generated',
      'Paper Generated',
      `Generated ${totalMarks} marks paper for ${bank.subject} (${bank.class})`,
      '#2196F3'
    );

    // Step 10: Return result
    return success(res, 'Paper generated successfully', {
      paperId, // FIXED: Return the same ID used in the HTML
      paperHtml,
      totalMarks,
      questionCount: selected.length,
      selectedQuestions: selected.map(q => ({
        questionId: q._id || q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        marks: q.marks,
        isImportant: q.isImportant
      }))
    });
  } catch (err) {
    console.error('generatePaper error:', err);
    return error(res, 'Failed to generate paper', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 12. GET /api/teacher/notes/:bankId
// ══════════════════════════════════════════════════════════════════════════════
const getNotes = async (req, res) => {
  try {
    const { bankId } = req.params;
    const teacherId = req.user.googleUid;

    const bank = await Bank.findById(bankId).select('teacherId subject class chapters');
    if (!bank) return error(res, 'Syllabus node not found in repository.', 'NOT_FOUND', 404);
    if (bank.teacherId !== teacherId) return error(res, 'Access denied to this vault.', 'FORBIDDEN', 403);

    // 1. Get the list of chapters defined in the Bank (Syllabus)
    const syllabusChapters = bank.chapters || [];

    // 2. Fetch all notes for this bank from MongoDB (Cloudinary vault)
    const notes = await Note.find({ bankId }).lean();

    // 3. Map syllabus chapters to included notes
    const chaptersWithNotes = syllabusChapters.map(chap => {
      const cId = chap.chapterId || chap._id?.toString() || '';
      return {
        chapterId: cId,
        chapterName: chap.chapterName,
        notes: notes.filter(n => n.chapterId === cId).map(n => ({
          noteId: n._id,
          fileName: n.fileName,
          fileUrl: generatePdfUrl(n.public_id, false, n.resource_type || 'raw', n.format), 
          noteType: n.noteType,
          uploadedAt: n.createdAt
        }))
      };
    });

    return success(res, 'Notes synced', {
      bankId,
      subject: bank.subject,
      class: bank.class,
      chapters: chaptersWithNotes
    });
  } catch (err) {
    if (err.name === 'CastError') return error(res, 'Invalid Sync ID provided.', 'BAD_REQUEST', 400);
    console.error('getNotes internal fault:', err);
    return error(res, 'Vault bridge internal fault.', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 13. POST /api/teacher/notes/upload
// ══════════════════════════════════════════════════════════════════════════════
const uploadNote = async (req, res) => {
  let tempFilePath = null;
  try {
    const { bankId, chapterId, chapterName, noteType } = req.body;
    const teacherId = req.user.googleUid;

    if (!bankId || !chapterId || !chapterName || !noteType) {
      return error(res, 'Syllabus keys missing for vault sync.', 'MISSING_FIELDS', 400);
    }

    if (!req.file) return error(res, 'Payload missing binary stream.', 'NO_FILE', 400);

    // Enforce size limits: 7MB for PDFs, 1MB for Images (User Protocol)
    const isPDF = req.file.mimetype === 'application/pdf';
    const limitBytes = isPDF ? 7 * 1024 * 1024 : 1 * 1024 * 1024;
    
    if (req.file.size > limitBytes) {
      return error(res, `Vault Overflow: ${isPDF ? 'PDFs' : 'Images'} must be under ${isPDF ? '7MB' : '1MB'} per protocol.`, 'FILE_TOO_LARGE', 400);
    }

    const bank = await Bank.findById(bankId);
    if (!bank) return error(res, 'Target bank node not found.', 'BANK_NOT_FOUND', 404);

    // SECURITY SEAL: Verify ownership (IDOR check)
    if (bank.teacherId !== teacherId) {
      return error(res, 'Access denied. You do not own this syllabus node.', 'FORBIDDEN', 403);
    }

    const existingNote = await Note.findOne({ bankId, chapterId, noteType });
    if (existingNote) {
      await deleteFromStorage(existingNote.public_id || existingNote.fileUrl);
      await Note.findByIdAndDelete(existingNote._id);
      await Bank.updateOne({ _id: bankId }, { $inc: { notesCount: -1 } });
    }

    const ext = req.file.mimetype === 'application/pdf' ? 'pdf' : 'jpg';
    tempFilePath = path.join(os.tmpdir(), `BEE_VAULT_${Date.now()}.${ext}`);
    fs.writeFileSync(tempFilePath, req.file.buffer);

    const result = await cloudinary.uploader.upload(tempFilePath, {
      resource_type: 'auto', // Let Cloudinary decide (PDFs often become 'image' for better delivery)
      type: 'upload',
      access_mode: 'public',
      folder: `beeprepare/notes/${teacherId}`,
      public_id: `${bankId}_${chapterId}_${noteType}_vault`.replace(/\s/g, '_')
    });

    const note = await Note.create({
      teacherId,
      bankId,
      subject: bank.subject,
      chapterId,
      chapterName,
      noteType,
      public_id: result.public_id,
      resource_type: result.resource_type,
      format: result.format || 'pdf',
      fileSize: req.file.size,
      fileName: req.file.originalname,
      fileType: ext === 'pdf' ? 'pdf' : 'image'
    });

    await Bank.updateOne({ _id: bankId }, { $inc: { notesCount: 1 } });

    await logActivity(teacherId, 'note_uploaded', 'Vault Sync',
      `Locked ${noteType} notes into the Cloudinary Vault for ${chapterName}`, '#FFD700');

    return success(res, 'Encrypted and stored in Cloudinary Vault!', {
      noteId: note._id,
      public_id: note.public_id,
      url: generatePdfUrl(note.public_id, false, note.resource_type, note.format)
    }, 201);

  } catch (err) {
    console.error('Vault upload fault:', err);
    return error(res, `Cloudinary vault synchronization failed: ${err.message || 'Unknown fault'}`, 'SERVER_ERROR', 500);
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (e) {}
    }
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 14. DELETE /api/teacher/notes/:id
// ══════════════════════════════════════════════════════════════════════════════
const deleteNote = async (req, res) => {
  try {
    const { id } = req.params;
    const teacherId = req.user.googleUid;

    const note = await Note.findById(id);
    if (!note) return error(res, 'Resource not found in vault.', 'NOT_FOUND', 404);
    if (note.teacherId !== teacherId) return error(res, 'Access denied to this resource.', 'FORBIDDEN', 403);

    // Wipe from Cloudinary
    await deleteFromStorage(note.public_id, note.resource_type || 'raw');

    await Note.findByIdAndDelete(id);
    await Bank.updateOne({ _id: note.bankId }, { $inc: { notesCount: -1 } });

    return success(res, 'Resource purged from Cloudinary Vault.');
  } catch (err) {
    console.error('Purge fault:', err);
    return error(res, 'Failed to purge resource.', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 15. GET /api/teacher/requests
// ══════════════════════════════════════════════════════════════════════════════
const getRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const teacherId = req.user.googleUid;

    const filter = { teacherId };
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Warm up Bank model for population
    const _b = Bank.modelName;

    const [requests, total] = await Promise.all([
      AccessRequest.find(filter)
        .populate('bankId', 'subject class bankCode')
        .sort({ status: 1, requestedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      AccessRequest.countDocuments(filter)
    ]);

    // Sort: pending first
    const sorted = [
      ...requests.filter(r => r.status === 'pending'),
      ...requests.filter(r => r.status !== 'pending')
    ];

    return success(res, 'Requests fetched', {
      requests: sorted.map(r => ({
        requestId: r._id,
        studentId: r.studentId,
        studentName: r.studentName,
        subject: r.bankId?.subject || 'Unknown',
        class: r.bankId?.class || 'N/A',
        bank: r.bankId,
        status: r.status,
        otpAttempts: r.otpAttempts,
        requestedAt: r.requestedAt,
        updatedAt: r.updatedAt,
        approvedAt: r.approvedAt,
        rejectedAt: r.rejectedAt
      })),
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    console.error('getRequests error:', err);
    return error(res, 'Failed to fetch requests', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 16. POST /api/teacher/requests/:id/approve
// ══════════════════════════════════════════════════════════════════════════════
const approveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const teacherId = req.user.googleUid;

    const request = await AccessRequest.findById(id);
    if (!request) return error(res, 'Request not found', 'NOT_FOUND', 404);
    if (request.teacherId !== teacherId) return error(res, 'Access denied', 'FORBIDDEN', 403);
    if (request.status !== 'pending') {
      return error(res, `Request is already ${request.status}`, 'INVALID_STATUS', 409);
    }

    const { plain, hash } = await generateOTP();
    const otpExpiresAt = new Date(Date.now() + parseInt(process.env.OTP_EXPIRY_HOURS || 24) * 3600000);

    await AccessRequest.updateOne({ _id: id }, {
      status: 'approved',
      otpHash: hash,           // Store ONLY the hash
      otpExpiresAt,
      otpAttempts: 0,
      approvedAt: new Date()
    });

    await logActivity(
      teacherId,
      'student_approved',
      'Student Approved',
      `Approved access request from ${request.studentName || request.studentId}`,
      '#4CAF50'
    );

    return success(res, 'Request approved. Share this OTP with the student (shown only once).', {
      requestId: id,
      studentName: request.studentName,
      plainOTP: plain           // Returned ONCE — never stored
    });
  } catch (err) {
    console.error('approveRequest error:', err);
    return error(res, 'Failed to approve request', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 17. POST /api/teacher/requests/:id/reject
// ══════════════════════════════════════════════════════════════════════════════
const rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const teacherId = req.user.googleUid;

    const request = await AccessRequest.findById(id);
    if (!request) return error(res, 'Request not found', 'NOT_FOUND', 404);
    if (request.teacherId !== teacherId) return error(res, 'Access denied', 'FORBIDDEN', 403);
    if (request.status === 'rejected') return error(res, 'Already rejected', 'ALREADY_REJECTED', 409);

    await AccessRequest.updateOne({ _id: id }, {
      status: 'rejected',
      rejectedAt: new Date()
    });

    return success(res, 'Request rejected', { requestId: id });
  } catch (err) {
    console.error('rejectRequest error:', err);
    return error(res, 'Failed to reject request', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 18. POST /api/teacher/requests/approve-all
// ══════════════════════════════════════════════════════════════════════════════
const approveAllRequests = async (req, res) => {
  try {
    const teacherId = req.user.googleUid;

    const pendingRequests = await AccessRequest.find({ teacherId, status: 'pending' });

    if (pendingRequests.length === 0) {
      return success(res, 'No pending requests to approve', { approved: [] });
    }

    const otpExpiresAt = new Date(Date.now() + parseInt(process.env.OTP_EXPIRY_HOURS || 24) * 3600000);
    const approved = [];

    for (const request of pendingRequests) {
      const { plain, hash } = await generateOTP();

      await AccessRequest.updateOne({ _id: request._id }, {
        status: 'approved',
        otpHash: hash,
        otpExpiresAt,
        otpAttempts: 0,
        approvedAt: new Date()
      });

      approved.push({
        requestId: request._id,
        studentName: request.studentName || request.studentId,
        plainOTP: plain
      });
    }

    await logActivity(
      teacherId,
      'student_approved',
      'Bulk Approval',
      `Approved ${approved.length} student request(s)`,
      '#4CAF50'
    );

    return success(res, `${approved.length} requests approved successfully`, { approved });
  } catch (err) {
    console.error('approveAllRequests error:', err);
    return error(res, 'Failed to approve all requests', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 19. GET /api/teacher/doubts
// ══════════════════════════════════════════════════════════════════════════════
const getDoubts = async (req, res) => {
  try {
    const { status } = req.query;
    const teacherId = req.user.googleUid;

    let query = { teacherId };
    if (status) query.status = status;

    const doubts = await Doubt.find(query).sort({ updatedAt: -1 }).lean();

    return success(res, 'Doubts fetched', {
      doubts: doubts.map(d => ({
        doubtId: d._id,
        studentId: d.studentId,
        studentName: d.studentName,
        subject: d.subject,
        status: d.status,
        unreadByTeacher: d.unreadByTeacher,
        lastMessage: d.messages?.[d.messages.length - 1]?.content || '',
        lastReplyAt: d.lastReplyAt,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt
      }))
    });
  } catch (err) {
    console.error('getDoubts error:', err);
    return error(res, 'Failed to fetch doubts', 'SERVER_ERROR', 500);
  }
};

const getDoubtMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const teacherId = req.user.googleUid;

    const doubt = await Doubt.findById(id);
    if (!doubt) return error(res, 'Doubt not found', 'NOT_FOUND', 404);
    if (doubt.teacherId !== teacherId) return error(res, 'Access denied', 'FORBIDDEN', 403);

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
           } catch(e) { console.error('Cloudinary cleanup error (teacher):', e); }
         }
         msg.imageUrl = 'EXPIRED';
         modified = true;
      }
    }

    if (modified) {
      await doubt.save();
    }

    // Mark as read by teacher
    if (doubt.unreadByTeacher) {
      doubt.unreadByTeacher = false;
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
// 20. POST /api/teacher/doubts/:id/reply
// ══════════════════════════════════════════════════════════════════════════════
const replyToDoubt = async (req, res) => {
  try {
    const { id } = req.params;
    let { content, imageUrl, status } = req.body;
    const teacherId = req.user.googleUid;

    if ((!content || !content.trim()) && !imageUrl) {
      return error(res, 'Reply content or image is required', 'EMPTY_CONTENT', 400);
    }
    if (content && content.trim().length > 500) {
      return error(res, 'To preserve cloud architecture stability, please keep replies under 500 characters', 'TOO_LONG', 400);
    }

    const doubt = await Doubt.findById(id);
    if (!doubt) return error(res, 'Doubt not found', 'NOT_FOUND', 404);
    if (doubt.teacherId !== teacherId) return error(res, 'Access denied', 'FORBIDDEN', 403);

    if (doubt.messages.length >= 50) {
      return error(res, 'This doubt thread has reached the maximum 50 messages limit. The student must mark it as resolved and start a new one.', 'THREAD_FULL', 400);
    }

    // Process Base64 image to Cloudinary if needed
    let finalImageUrl = imageUrl || null;
    if (imageUrl && imageUrl.startsWith('data:image')) {
      try {
        const uploadRes = await cloudinary.uploader.upload(imageUrl, {
          folder: `doubts/teacher_${teacherId}`,
          resource_type: 'image',
          format: 'webp',
          quality: 'auto'
        });
        finalImageUrl = uploadRes.secure_url;
      } catch (uploadErr) {
        console.error('Cloudinary upload failure:', uploadErr);
        return error(res, 'Failed to process image attachment', 'UPLOAD_ERROR', 500);
      }
    }

    const now = new Date();
    const message = {
      messageId: crypto.randomUUID(),
      senderId: teacherId,
      senderRole: 'teacher',
      content: content?.trim() || '[Image Attached]',
      imageUrl: finalImageUrl,
      timestamp: now
    };

    doubt.messages.push(message);
    doubt.status = status || 'replied';
    doubt.unreadByStudent = true;
    doubt.unreadByTeacher = false;
    doubt.lastReplyAt = now;
    
    await doubt.save();

    await logActivity(
      teacherId,
      'doubt_replied',
      'Doubt Replied',
      `Replied to doubt from ${doubt.studentName || doubt.studentId}`,
      '#FF9800'
    );

    return success(res, 'Reply sent successfully', {
      doubtId: id,
      message,
      status: doubt.status
    });
  } catch (err) {
    console.error('replyToDoubt error:', err);
    return error(res, 'Failed to send reply', 'SERVER_ERROR', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 21. GET /api/teacher/activity
// ══════════════════════════════════════════════════════════════════════════════
const getActivity = async (req, res) => {
  try {
    const teacherId = req.user.googleUid;

    const logs = await ActivityLog.find({ userId: teacherId })
      .sort({ createdAt: -1 })
      .limit(50);

    return success(res, 'Activity log fetched', { activities: logs });
  } catch (err) {
    console.error('getActivity error:', err);
    return error(res, 'Failed to fetch activity log', 'SERVER_ERROR', 500);
  }
};

const https = require('https');

const downloadNote = async (req, res) => {
  try {
    const { id } = req.params;
    const teacherId = req.user.googleUid;

    const note = await Note.findById(id);
    if (!note) return error(res, 'Vault node not found.', 'NOT_FOUND', 404);
    if (note.teacherId !== teacherId) return error(res, 'Access denied.', 'FORBIDDEN', 403);

    // Generate the signed URL (internal)
    const downloadUrl = generatePdfUrl(note.public_id, true, note.resource_type || 'raw', note.format);
    
    // Stream the file directly to the client (Bypasses 401 browser issues)
    https.get(downloadUrl, (cloudinaryRes) => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${note.fileName || 'note.pdf'}"`);
      cloudinaryRes.pipe(res);
    }).on('error', (err) => {
      throw err;
    });

  } catch (err) {
    console.error('Vault download fault:', err);
    return error(res, `Vault synchronization failed: ${err.message}`, 'SERVER_ERROR', 500);
  }
};

module.exports = {
  upload,
  getDashboard,
  getProfile,
  updateProfile,
  addSubject,
  deleteSubject,
  getChapters,
  addChapter,
  deleteChapter,
  getQuestions,
  addQuestion,
  deleteQuestion,
  generatePaper,
  getNotes,
  uploadNote,
  downloadNote,
  deleteNote,
  getRequests,
  approveRequest,
  rejectRequest,
  approveAllRequests,
  getDoubts,
  getDoubtMessages,
  replyToDoubt,
  getActivity
};
