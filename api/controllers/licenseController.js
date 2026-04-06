const User = require('../models/User');
const { success, error } = require('../utils/responseHelper');
const { db } = require('../config/firebase');

/**
 * POST /api/license/verify
 * FIX 2: Activation loop fix with Firestore/MongoDB syncing
 */
const verifyKey = async (req, res) => {
  const { licenseKey } = req.body;

  if (!licenseKey) {
    return error(res, 'License key required', 'MISSING_KEY', 400);
  }

  const keyTrimmed = licenseKey.trim().toUpperCase();
  let keyRef = db.collection('activation_keys').doc(keyTrimmed);

  let keyData = null;

  // Step 0: Try to find document by field 'key' if direct doc lookup fails
  try {
    let keyDoc = await keyRef.get();
    
    if (!keyDoc.exists) {
      // Fallback: Query by field 'key'
      const querySnapshot = await db.collection('activation_keys')
        .where('key', '==', keyTrimmed)
        .limit(1)
        .get();

      if (querySnapshot.empty) {
        return error(res, 'License key not found. Please check and try again.', 'KEY_NOT_FOUND', 404);
      }
      
      keyRef = querySnapshot.docs[0].ref;
    }
  } catch (err) {
    console.error('Initial key check failed:', err);
  }

  // Step 1: Firestore atomic transaction
  try {
    const result = await db.runTransaction(async (transaction) => {
      const keyDoc = await transaction.get(keyRef);

      if (!keyDoc.exists) {
        return {
          errorCode: 'KEY_NOT_FOUND',
          message: 'License key not found'
        };
      }

      const data = keyDoc.data();

      // Ensure data has the key (useful if we found it by doc ID)
      if (!data.key) data.key = keyTrimmed;

      if (data.isUsed) {
        // Check if this same user already used this key (re-login case)
        if (data.usedBy === req.user.googleUid) {
          // Same user ΓÇö just re-activate them in MongoDB, dont error
          return {
            reactivate: true,
            keyData: data
          };
        }
        return {
          errorCode: 'ALREADY_USED',
          message: 'Key already used'
        };
      }

      const now = new Date();
      if (data.expiresAt && data.expiresAt.toDate() < now) {
        return {
          errorCode: 'KEY_EXPIRED',
          message: 'Key has expired'
        };
      }

      // Mark as used
      transaction.update(keyRef, {
        isUsed: true,
        usedBy: req.user.googleUid,
        usedAt: now
      });

      return { keyData: data };
    });

    if (result.errorCode) {
      const statusMap = {
        KEY_NOT_FOUND: 404,
        ALREADY_USED: 409,
        KEY_EXPIRED: 410
      };
      return error(
        res,
        result.message,
        result.errorCode,
        statusMap[result.errorCode] || 400
      );
    }

    keyData = result.keyData;

  } catch (firestoreErr) {
    console.error('Firestore error during activation:', firestoreErr);
    return error(res,
      'Activation failed. Please try again.',
      'FIRESTORE_ERROR', 500
    );
  }

  // Step 2: MongoDB update
  // If this fails we need to rollback Firestore
  try {
    await User.updateOne(
      { googleUid: req.user.googleUid },
      {
        isActivated: true,
        licenseKey: keyTrimmed,
        planType: keyData.plan || 'basic',
        subjectLimit: keyData.subjectLimit || 3,
        licenseActivatedAt: new Date(),
        licenseExpiresAt: keyData.expiresAt ? keyData.expiresAt.toDate() : null
      }
    );

    return success(res, 'License activated successfully', {
      planType: keyData.plan || 'basic',
      subjectLimit: keyData.subjectLimit || 3,
      redirectTo: 'role-select'
    });

  } catch (mongoErr) {
    // CRITICAL: MongoDB failed but Firestore already marked key as used.
    // Roll back Firestore so user can try again!
    console.error('CRITICAL: MongoDB update failed, rolling back Firestore key...', mongoErr);

    try {
      await keyRef.update({
        isUsed: false,
        usedBy: null,
        usedAt: null
      });
      console.log('Firestore rollback success');
    } catch (rollbackErr) {
      console.error('Rollback failed! Key might be burned. Manual intervention needed.', rollbackErr);
    }

    return error(res,
      'Activation failed. Key has been released. Please try again.',
      'ACTIVATION_FAILED', 500
    );
  }
};

module.exports = { verifyKey };
