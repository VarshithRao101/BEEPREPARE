const { success, error } = require('../utils/responseHelper');
const { validateRedeemKey } = require('../services/keyService');

const redeemKey = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return error(res, 'Redeem code is required', 'MISSING_CODE', 400);

    const result = await validateRedeemKey(req.user.googleUid, code);

    if (result.error) {
      const statusMap = { INVALID_FORMAT: 400, KEY_NOT_FOUND: 404, ALREADY_USED: 409 };
      return error(res, result.message, result.error, statusMap[result.error] || 400);
    }

    return success(res, `System upgraded! ${result.valueAdded} extra subject slots added. 🐝💎`, {
      type: 'redeem',
      value: result.valueAdded
    });

  } catch (err) {
    console.error('redeemController.redeemKey error:', err);
    return error(res, 'Failed to redeem code', 'SERVER_ERROR', 500);
  }
};

module.exports = { redeemKey };
