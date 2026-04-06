const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

// Strips $ and . from request body/params/query
const sanitizeMiddleware = [
  mongoSanitize({
    replaceWith: '_'
  }),
  hpp()
];

module.exports = sanitizeMiddleware;
