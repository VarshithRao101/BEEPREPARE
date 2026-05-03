const LicenseKey = require('../models/LicenseKey');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { success, error } = require('../utils/responseHelper');

const verifyKey = async (req, res) => {
  try {
    const { licenseKey } = req.body;

    if (!licenseKey) {
      return error(res,
        'License key required',
        'MISSING_KEY', 400);
    }

    const keyTrimmed = licenseKey.trim().toUpperCase();

    // Atomic claim — prevents race conditions
    const key = await LicenseKey
      .findOneAndUpdate(
        {
          key: keyTrimmed,
          type: 'activation',
          isUsed: false
        },
        {
          isUsed: true,
          usedBy: req.user.googleUid,
          usedAt: new Date()
        },
        { new: true }
      );

    if (!key) {
      // Check why it failed
      const exists = await LicenseKey
        .findOne({ key: keyTrimmed }).select('_id usedBy').lean();

      if (!exists) {
        return error(res,
          'License key not found.',
          'KEY_NOT_FOUND', 404);
      }

      // Same user trying again?
      if (exists.usedBy ===
          req.user.googleUid) {
        // Self-heal
        await User.updateOne(
          { googleUid: req.user.googleUid },
          {
            isActivated: true,
            licenseKey: keyTrimmed,
            planType: 'active',
            subjectLimit: 1
          }
        );
        return success(res,
          'Already activated', {
          subjectLimit: 1,
          planType: 'active',
          redirectTo: 'role-select'
        });
      }

      return error(res,
        'Key already used.',
        'ALREADY_USED', 409);
    }

    // Success — activate user
    await User.updateOne(
      { googleUid: req.user.googleUid },
      {
        isActivated: true,
        licenseKey: keyTrimmed,
        planType: 'active',
        subjectLimit: 1,
        licenseActivatedAt: new Date()
      }
    );
    
    await ActivityLog.create({
      userId: req.user.googleUid,
      type: 'key_activated',
      title: 'Key Activated',
      description: `License key ${keyTrimmed} activated successfully.`,
      ip: req.ip,
      color: '#FFD700'
    });

    return success(res,
      'Account activated!', {
      subjectLimit: 1,
      planType: 'active',
      redirectTo: 'role-select'
    });

  } catch (err) {
    console.error('verifyKey error:',
      err.message);
    return error(res,
      'Activation failed. Try again.',
      'SERVER_ERROR', 500);
  }
};

module.exports = { verifyKey };

// Sync: 2026-04-26-01-44
