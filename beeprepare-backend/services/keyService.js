const { db } = require('../config/firebase');
const User = require('../models/User');
const { AppSettings } = require('../models/AppSettings');
const FirestoreTracker = require('../utils/firestoreTracker');

// REGEX: Strict validation as per Step 3
const ACTIVATION_REGEX = /^BEE-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/;
const REDEEM_REGEX = /^BEE[A-Za-z0-9]{6}$/;

const trackFirestoreRead = async () => {
  const today = new Date().toISOString().split('T')[0];
  try {
    const dateDoc = await AppSettings.findOne({ key: 'firestore_reads_date' });

    if (!dateDoc || dateDoc.value !== today) {
      // New day - reset counter
      await AppSettings.findOneAndUpdate(
        { key: 'firestore_reads_date' },
        { value: today }, { upsert: true });
      await AppSettings.findOneAndUpdate(
        { key: 'firestore_reads_today' },
        { value: 0 }, { upsert: true });
    } else {
      // Increment counter
      await AppSettings.findOneAndUpdate(
        { key: 'firestore_reads_today' },
        { $inc: { value: 1 } },
        { upsert: true });
    }
  } catch (err) {
    // Don't fail if tracking fails
  }
};

const validateActivationKey = async (userId, key) => {
  // 1. Format Check (Strict Regex)
  if (!ACTIVATION_REGEX.test(key)) {
    return { error: 'INVALID_FORMAT', message: 'Activation key must follow BEE-XXXX-XXXX-XXXX format' };
  }

  // 2. Optimized Lookup (Single Read)
  const tracker = new FirestoreTracker(userId);
  const keyUpper = key.toUpperCase();
  
  tracker.trackRead('activation_keys', keyUpper);
  const keyRef = db.collection('activation_keys').doc(keyUpper);
  await trackFirestoreRead(); // Track in MongoDB
  const keyDoc = await keyRef.get();

  if (!keyDoc.exists) {
    return { error: 'KEY_NOT_FOUND', message: 'Activation key not found in our records' };
  }

  const keyData = keyDoc.data();

  // 3. Atomic Update (Secure)
  if (keyData.isUsed) return { error: 'ALREADY_USED', message: 'This key has already been activated' };

  tracker.trackWrite('activation_keys', keyUpper, 'update');
  await keyRef.update({
    isUsed: true,
    assigned_to: userId,
    used_at: new Date()
  });

  return { success: true, plan: keyData.plan || 'premium' };
};

const validateRedeemKey = async (userId, key) => {
  // 1. Format Check
  if (!REDEEM_REGEX.test(key)) {
    return { error: 'INVALID_FORMAT', message: 'Redeem key must follow BEEXXXXXX format' };
  }

  const tracker = new FirestoreTracker(userId);
  const keyUpper = key.toUpperCase();
  const keyRef = db.collection('redeem_keys').doc(keyUpper);

  // 2. Transaction
  return await db.runTransaction(async (transaction) => {
    tracker.trackRead('redeem_keys', keyUpper);
    await trackFirestoreRead(); // Track in MongoDB
    const keyDoc = await transaction.get(keyRef);

    if (!keyDoc.exists) return { error: 'KEY_NOT_FOUND', message: 'Redeem key not found' };
    
    const keyData = keyDoc.data();
    if (keyData.is_used) return { error: 'ALREADY_USED', message: 'This redeem key has already been used' };

    // Fetch User to update subject_limit atomically
    const user = await User.findOne({ googleUid: userId });
    if (!user) return { error: 'USER_NOT_FOUND', message: 'User not found in system' };

    // Mark used
    tracker.trackWrite('redeem_keys', keyUpper, 'update');
    transaction.update(keyRef, {
      is_used: true,
      assigned_to: userId,
      used_at: new Date()
    });

    // Update User subject limit
    const value = keyData.value || 1;
    await User.updateOne({ googleUid: userId }, {
      $inc: { subjectLimit: value }
    });

    return { success: true, valueAdded: value };
  });
};

module.exports = { validateActivationKey, validateRedeemKey };
