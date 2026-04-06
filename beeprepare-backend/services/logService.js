const { db } = require('../config/firebase');
const logger = require('../utils/logger'); // Ensure we use Winston too

const LOGIN_CACHE = new Map();
const LOG_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

const logLogin = async (userId) => {
  try {
    const now = Date.now();
    const lastLog = LOGIN_CACHE.get(userId);
    if (lastLog && (now - lastLog < LOG_EXPIRY_MS)) {
        logger.info(`Login Record (Cached - Skip Firestore): ${userId}`);
        return;
    }
    LOGIN_CACHE.set(userId, now);

    console.log(`[FIRESTORE TRACKER] Login Log Triggered for ${userId}`);
    
    // Step 4 Optimization: Skip logging in development to save Firestore usage
    if (process.env.NODE_ENV === 'development') {
        logger.info(`Login Record (Development - Skip Firestore): ${userId}`);
        return;
    }

    // Insert into Firestore: Step 5 logic
    await db.collection('login_logs').add({
      user_id: userId,
      login_time: new Date(),
      status: 'success'
    });
    logger.info(`Login Record Logged (Firestore): ${userId}`);
  } catch (err) {
    logger.error('Failed to log login record to Firestore:', err.message);
  }
};

module.exports = { logLogin };
