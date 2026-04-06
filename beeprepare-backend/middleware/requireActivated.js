const { error } = require('../utils/responseHelper');

const requireActivated = (req, res, next) => {
  if (!req.user) {
    return error(res, 'Not authenticated', 'NOT_AUTHENTICATED', 401);
  }
  if (!req.user.isActivated) {
    return error(res, 'Please activate your account with a license key first', 'NOT_ACTIVATED', 403);
  }
  next();
};

module.exports = requireActivated;
