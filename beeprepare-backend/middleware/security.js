const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const crypto = require('crypto');

// === SECURITY HEADERS ===
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "https://cdn.jsdelivr.net",
        "https://www.gstatic.com",
        "https://apis.google.com",
        "https://cdn.sheetjs.com",
        "blob:", 
        "'unsafe-inline'"
      ],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: [
        "'self'",
        "https://fonts.googleapis.com",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com", // Added for FontAwesome
        "'unsafe-inline'"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com" // Added for FontAwesome
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https://storage.googleapis.com",
        "https://res.cloudinary.com",
        "https://lh3.googleusercontent.com"
      ],
      mediaSrc: ["'self'", "data:"],
      connectSrc: [
        "'self'",
        "https://*.firebaseapp.com",
        "https://*.googleapis.com",
        "https://identitytoolkit.googleapis.com",
        "https://securetoken.googleapis.com",
        "wss:"
      ],
      frameSrc: ["'self'", "https://*.firebaseapp.com", "https://*.google.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  }
});

// === REQUEST ID TRACKING ===
const requestTracker = (req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  res.setHeader('X-Powered-By', 'BEEPREPARE');
  next();
};

// === INPUT SANITIZATION ===
const sanitizeInput = (req, res, next) => {
  // Remove MongoDB operators from body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  next();
};

const sanitizeObject = (obj) => {
  if (typeof obj !== 'object' || !obj) {
    return obj;
  }
  
  // Handle Arrays
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const clean = {};
  for (const key of Object.keys(obj)) {
    // Block MongoDB operators at the start of keys ONLY
    if (key.startsWith('$')) {
      continue;
    }

    const val = obj[key];
    if (typeof val === 'string') {
      // Remove potentially harmful script tags but keep normal text
      clean[key] = val
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+\s*=/gi, '') // Remove inline event handlers
        .trim();
    } else if (typeof val === 'object') {
      clean[key] = sanitizeObject(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
};

// === BLOCK SUSPICIOUS PATTERNS ===
const blockSuspiciousRequests = (req, res, next) => {
  const suspicious = [
    '../', '..\\',
    '<script',
    'eval(', 'exec(',
    'DROP TABLE',
    'UNION SELECT',
    '/etc/passwd',
    'cmd.exe'
  ];

  const checkString = (str) => {
    if (typeof str !== 'string') return false;
    // Only block if it looks like an actual exploit attempt
    return suspicious.some(pattern =>
      str.includes(pattern) // Case sensitive for some patterns to avoid common words
    );
  };

  const body = JSON.stringify(req.body || {});
  const query = JSON.stringify(req.query || {});
  const url = req.originalUrl;

  if (checkString(body) ||
      checkString(query) ||
      checkString(url)) {
    console.warn(
      `[SECURITY] Suspicious request blocked`,
      {
        ip: req.ip,
        url: req.originalUrl,
        requestId: req.id
      }
    );
    return res.status(400).json({
      success: false,
      message: 'Security violation detected.',
      error: { code: 'SECURITY_BLOCK' }
    });
  }
  next();
};

// === RESPONSE SANITIZATION ===
// Prevent sensitive data leaks
const sanitizeResponse = (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (data) => {
    if (data && typeof data === 'object') {
      data = removeSensitiveFields(data);
    }
    return originalJson(data);
  };
  next();
};

const SENSITIVE_FIELDS = [
  'password', 'hash', 'otpHash',
  'licenseKey', '__v', 'privateKey',
  'MONGODB_URI', 'GEMINI_API_KEY',
  'RESEND_API_KEY', 'FIREBASE_PRIVATE_KEY',
  'ADMIN_JWT_SECRET'
];

const removeSensitiveFields = (obj) => {
  if (!obj) return obj;
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(removeSensitiveFields);
  }
  
  // Handle non-objects
  if (typeof obj !== 'object') {
    return obj;
  }

  // Deep clone to avoid mutating original and handle enumerable properties correctly
  let clean;
  try {
    clean = JSON.parse(JSON.stringify(obj));
  } catch (err) {
    return obj; // Fallback if circular or non-serializable
  }

  const recursivelyClean = (item) => {
    if (!item || typeof item !== 'object') return item;
    
    if (Array.isArray(item)) {
      return item.map(recursivelyClean);
    }

    for (const field of SENSITIVE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(item, field)) {
        delete item[field];
      }
    }

    for (const key of Object.keys(item)) {
      if (item[key] && typeof item[key] === 'object') {
        item[key] = recursivelyClean(item[key]);
      }
    }
    return item;
  };

  return recursivelyClean(clean);
};

// === IP EXTRACTION ===
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']
    ?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.ip ||
    'unknown';
};

module.exports = {
  securityHeaders,
  requestTracker,
  sanitizeInput,
  blockSuspiciousRequests,
  sanitizeResponse,
  mongoSanitize,
  hpp,
  getClientIp
};
