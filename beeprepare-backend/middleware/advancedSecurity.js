const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Tracker: UUID per request
const requestIdentifier = (req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-Id', req.id);
  next();
};

// Logger: logs every incoming request
const requestLogger = (req, res, next) => {
  logger.info(`HTTP ${req.method} ${req.originalUrl}`, {
    requestId: req.id,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    body: req.method !== 'GET' ? req.body : undefined
  });
  next();
};

const advancedSecurity = [
  requestIdentifier,
  requestLogger
];

module.exports = advancedSecurity;
