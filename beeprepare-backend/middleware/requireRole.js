const { error } = require('../utils/responseHelper');

const requireRole = (role) => (req, res, next) => {
  if (!req.user) {
    return error(res, 'Not authenticated', 'NOT_AUTHENTICATED', 401);
  }
  if (req.user.role !== role) {
    return error(res, `Access restricted to ${role}s only`, 'WRONG_ROLE', 403);
  }
  next();
};

module.exports = requireRole;
