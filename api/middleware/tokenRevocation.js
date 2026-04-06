const logger = require('../utils/logger');

// SaaS Ready: In a real enterprise app, use Redis. 
// For this SaaS-Ready architecture, we provide the logic and an in-memory fallback.
const revokedTokens = new Set(); 

const revokeTokenManually = (token) => {
  revokedTokens.add(token);
  logger.warn(`Token Revoked: ${token.substring(0, 10)}...`);
};

// Middleware: check if token was revoked
const checkRevokedToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return next();
  
  const token = authHeader.split('Bearer ')[1];
  if (revokedTokens.has(token)) {
    logger.warn(`Access Attempt with Revoked Token from IP: ${req.ip}`);
    return res.status(401).json({
      success: false,
      message: 'Token has been revoked. Please log in again.',
      error: { code: 'TOKEN_REVOKED' }
    });
  }
  next();
};

module.exports = { checkRevokedToken, revokeTokenManually };
