const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'beeprepare-backend', 'controllers', 'studentController.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Replace the corrupted line 1 (index 0) with clean header
const cleanHeader = `const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
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
const updateStreak = require('../utils/streakHelper');
const { success, error } = require('../utils/responseHelper');

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

const getStoragePath = (fileUrl) => {
  try {
    const url = new URL(fileUrl);
    const pathMatch = url.pathname.match(/\\/o\\/(.+)/);
    if (pathMatch) return decodeURIComponent(pathMatch[1]);
  } catch (_) {}
  return fileUrl;
};

// ─── Signed URL Cache (5-min buffer, avoids re-generating within expiry) ──────
const signedUrlCache = new Map();
const SIGNED_URL_CACHE_BUFFER = 5 * 60 * 1000;

const generateSignedUrl = async (fileUrl) => {
  try {
    if (!fileUrl) return null;
    if (fileUrl.includes('cloudinary.com')) return fileUrl;
    const storagePath = getStoragePath(fileUrl);
    if (!fileUrl.includes('storage.googleapis.com') && !fileUrl.includes('firebasestorage')) return fileUrl;
    const cached = signedUrlCache.get(fileUrl);
    if (cached && Date.now() < cached.expiresAt - SIGNED_URL_CACHE_BUFFER) return cached.url;
    const expirySeconds = parseInt(process.env.SIGNED_URL_EXPIRY_SECONDS || 3600);
    const [signedUrl] = await bucket.file(storagePath).getSignedUrl({ action: 'read', expires: Date.now() + expirySeconds * 1000 });
    signedUrlCache.set(fileUrl, { url: signedUrl, expiresAt: Date.now() + expirySeconds * 1000 });
    return signedUrl;
  } catch (e) {
    console.warn('Firebase Signed URL skipped/failed:', e.message);
    return fileUrl;
  }
};`;

// lines[0] is the corrupted line, lines[1] is blank, lines[2+] is valid code
const rest = lines.slice(2).join('\n');
const newContent = cleanHeader + '\n' + rest;

fs.writeFileSync(filePath, newContent, 'utf8');
const lineCount = newContent.split('\n').length;
console.log(`Done! New line count: ${lineCount}`);
