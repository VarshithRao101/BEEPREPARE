const LicenseKey = require('../models/LicenseKey');
const User = require('../models/User');
const { success, error } = require('../utils/responseHelper');

const redeemCode = async (req, res) => {
  try {
    const { code } = req.body;
    const googleUid = req.user.googleUid;

    if (!code) {
      return error(res,
        'Redeem code required',
        'MISSING_CODE', 400);
    }

    const codeTrimmed = code.trim().toUpperCase();

    // Must be activated to redeem
    if (!req.user.isActivated) {
      return error(res,
        'Activate your account first.',
        'NOT_ACTIVATED', 403);
    }

    // Atomic claim
    const redeemKey = await LicenseKey
      .findOneAndUpdate(
        {
          key: codeTrimmed,
          type: 'redeem',
          isUsed: false
        },
        {
          isUsed: true,
          usedBy: googleUid,
          usedAt: new Date()
        },
        { new: true }
      );

    if (!redeemKey) {
      const exists = await LicenseKey
        .findOne({
          key: codeTrimmed,
          type: 'redeem'
        });

      if (!exists) {
        return error(res,
          'Redeem code not found.',
          'CODE_NOT_FOUND', 404);
      }

      if (exists.usedBy === googleUid) {
        return error(res,
          'You already used this code.',
          'ALREADY_USED', 409);
      }

      return error(res,
        'Code already used.',
        'ALREADY_USED', 409);
    }

    // Add exactly +1 slot
    await User.updateOne(
      { googleUid },
      { $inc: { subjectLimit: 1 } }
    );

    const updated = await User.findOne(
      { googleUid },
      'subjectLimit'
    );

    return success(res,
      '+1 subject slot unlocked! 🎉', {
      newSubjectLimit: updated.subjectLimit,
      slotsAdded: 1
    });

  } catch (err) {
    console.error('redeemCode error:',
      err.message);
    return error(res,
      'Redeem failed.',
      'SERVER_ERROR', 500);
  }
};

module.exports = { redeemCode };
