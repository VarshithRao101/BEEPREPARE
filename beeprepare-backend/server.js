require('dotenv').config(); // BEEPREPARE Server Environment Config
const validateEnv = require('./config/validateEnv');
validateEnv(); // Ensure all 12+ env keys are present

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const connectDB = require('./config/db');
require('./config/firebase');
// Removed unused mongoSanitize/hpp for express v4 compatibility
const logger = require('./utils/logger'); // 1. Centralized Logger
const advancedSecurity = require('./middleware/advancedSecurity'); // 2. Request Tracking & XSS
const { checkRevokedToken } = require('./middleware/tokenRevocation'); // 3. Blacklist System
const { loginLimiter } = require('./middleware/rateLimiters'); // 4. Brute-Force Protection

const app = express();

// Connect to MongoDB
connectDB();

// === CORS — MUST BE FIRST ===
const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:3000',
  'null'
];

app.use(cors({
  origin: (origin, callback) => {
    // Force allow in development or if origin matches
    if (!origin || process.env.NODE_ENV === 'development' || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id']
}));

app.use((req, res, next) => {
  res.setHeader(
    'Cross-Origin-Opener-Policy', 'unsafe-none'
  );
  res.setHeader(
    'Cross-Origin-Embedder-Policy', 'unsafe-none'
  );
  next();
});

// === REQUEST TRACKING & LOGGING ===
app.use(advancedSecurity); // Adds UUIDs and logs every request

// === SECURITY HEADERS ===
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  contentSecurityPolicy: false
}));

// === COMPRESSION ===
app.use(compression());

// === REQUEST SIZE LIMITS ===
app.use(express.json({ limit: process.env.MAX_REQUEST_SIZE || '10mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.MAX_REQUEST_SIZE || '10mb' }));

// === GLOBAL RATE LIMITER ===
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500, // 500 requests per minute (Relaxed from 100 for better scalability)
  message: { 
    success: false, 
    message: 'Too many requests. Please slow down.',
    error: { code: 'RATE_LIMITED' }
  }
});
app.use(globalLimiter);

// === TOKEN BLACKLIST CHECK ===
app.use(checkRevokedToken);

// === ROUTES ===
const requireAuth = require('./middleware/requireAuth');

// Production Main Routes
app.use('/api/auth',     loginLimiter, require('./routes/auth')); 
app.use('/api/license',  requireAuth,  require('./routes/license'));
app.use('/api/redeem',   requireAuth,  require('./routes/redeem'));
app.use('/api/teacher',  requireAuth,  require('./routes/teacher'));
app.use('/api/student',  requireAuth,  require('./routes/student'));
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100, // 100 per minute (Relaxed from 20)
  message: {
    success: false,
    message: 'Too many AI requests.',
    error: {
      code: 'AI_RATE_LIMIT',
      details: 'Max 100 AI requests per minute.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Mount AI limiter BEFORE the route
app.use('/api/ai', aiLimiter);
app.use('/api/ai', requireAuth, require('./routes/ai')); 
app.use('/api/feedback', requireAuth,  require('./routes/feedback'));

// ISOLATED Test & Debug Routes (Development Only)
app.use('/api/dev',      require('./routes/dev'));

// === HEALTH & MONITORING ===
app.get('/health', (req, res) => {
  const status = {
    success: true,
    status: 'healthy',
    uptime: Math.floor(process.uptime()),
    memoryUsage: process.memoryUsage(),
    timestamp: new Date().toISOString(),
    requestId: req.id
  };
  res.status(200).json(status);
});

// === 404 HANDLER ===
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    error: { code: 'NOT_FOUND' }
  });
});

// === GLOBAL ERROR HANDLER ===
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ success: false, message: 'CORS Blocked', error: { code: 'CORS_INVALID' }});
  }
  
  // Log every error with Request ID!
  logger.error(err.message, { 
    requestId: req.id, 
    path: req.originalUrl,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined 
  });

  const message = process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error';
  
  // Ensure CORS headers on errors!
  const reqOrigin = req.headers.origin;
  if (allowedOrigins.includes(reqOrigin)) {
    res.header('Access-Control-Allow-Origin', reqOrigin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }

  res.status(err.status || 500).json({
    success: false,
    message,
    error: { code: err.code || 'SERVER_ERROR', requestId: req.id }
  });
});

// === START SERVER OR EXPORT FOR VERCEL ===
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    logger.info(`🚀 BEEPREPARE Server running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
}

module.exports = app;
