require('dotenv').config();
const validateEnv = require('./config/validateEnv');
validateEnv();

const express = require('express');
const app = express();
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

const {
  securityHeaders,
  requestTracker,
  sanitizeInput,
  blockSuspiciousRequests,
  sanitizeResponse
} = require('./middleware/security');

const {
  globalLimiter,
  authLimiter,
  activationLimiter,
  aiLimiter,
  otpLimiter,
  paymentLimiter,
  uploadLimiter,
  speedLimiter
} = require('./middleware/rateLimiters');

const { connectDB } = require('./config/db');
require('./config/firebase');
const logger = require('./utils/logger');

// === SYSTEM CONFIG ===
app.set('trust proxy', 1); // Trust the first proxy (Vercel, Render, Nginx etc.) for IP tracking

// Connect DBs
connectDB();

// === SECURITY HEADERS FIRST ===
app.use(securityHeaders);

// Manual Security Guard (Just in case)
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// === REQUEST TRACKING ===
app.use(requestTracker);

// === CORS — LOCKED DOWN ===
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5000',
  'http://127.0.0.1:5000'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow no-origin (mobile apps, curl) in development only
    if (!origin) {
      if (process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      return callback(new Error('Origin required'), false);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn('[CORS BLOCKED]', origin);
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id']
}));

// === REQUEST PARSING WITH LIMITS ===
app.use(express.json({
  limit: '10mb',
  strict: true
}));
app.use(express.urlencoded({
  extended: true,
  limit: '10mb'
}));

// === SECURITY MIDDLEWARE CHAIN ===
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(
      `[NOSQL INJECTION] Blocked key: ${key}`,
      { ip: req.ip, url: req.originalUrl }
    );
  }
}));

app.use(hpp());
app.use(sanitizeInput);
app.use(blockSuspiciousRequests);
app.use(sanitizeResponse);


// === RATE LIMITING ===
app.use(globalLimiter);
app.use(speedLimiter);

// === ROLLING ADMIN GATEWAY ===
const getRollingSecret = (offset = 0) => {
  const secret = process.env.ADMIN_ENTRY_SECRET || 'BEE_DEFAULT_MASTER_SECRET';
  const window = Math.floor(Date.now() / (5 * 60 * 1000)) + offset;
  return crypto.createHmac('sha256', secret)
    .update(window.toString())
    .digest('hex')
    .substring(0, 8);
};

app.get('/gatekeeper', (req, res) => {
  const key = req.query.key;
  if (!key || key !== process.env.ADMIN_GATE_KEY) {
    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>Access Denied | BEEPREPARE</title>
          <style>
              body { margin: 0; height: 100vh; display: flex; align-items: center; justify-content: center; background: #000; color: #fff; font-family: sans-serif; overflow: hidden; }
              .bg { position: fixed; inset: 0; background: #080808; z-index: -1; }
              .card { background: rgba(18, 18, 18, 0.8); backdrop-filter: blur(20px); padding: 50px; border-radius: 40px; border: 1px solid rgba(255, 215, 0, 0.2); text-align: center; box-shadow: 0 50px 100px rgba(0,0,0,0.8); }
              h1 { color: #FFD700; font-size: 42px; margin: 0 0 10px; }
              p { color: #888; font-size: 18px; margin: 0; }
          </style>
      </head>
      <body>
          <div class="bg"></div>
          <div class="card">
              <h1>🚫 Access Denied</h1>
              <p>Matrix Node Entry Requires Authorized Key.</p>
          </div>
      </body>
      </html>
    `);
  }
  const currentCode = getRollingSecret(0);
  res.redirect(`/gate/${currentCode}/index.html`);
});

app.use('/assets', express.static(path.join(__dirname, '../assets')));
app.use('/gate/:code', (req, res, next) => {
  const code = req.params.code;
  const current = getRollingSecret(0);
  const previous = getRollingSecret(-1);
  if (code === current || code === previous) {
    return next();
  }
  res.status(404).send('<h1>🔍 Node Not Found</h1><p>Expired or invalid path.</p>');
}, express.static(path.join(__dirname, `../${process.env.ADMIN_FOLDER_NAME || 'matrix-core-v1419'}`)));

// === MAINTENANCE MODE CHECK ===
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api/admin') ||
      req.path.startsWith('/api/payment') ||
      req.path === '/health') {
    return next();
  }
  try {
    const AppSettings = require('./models/AppSettings');
    const setting = await AppSettings.findOne({ key: 'maintenance_mode' }).lean();
    if (setting?.value === true) {
      return res.status(503).json({
        success: false,
        message: 'Under maintenance.',
        code: 'MAINTENANCE_MODE',
        maintenance: true
      });
    }
  } catch (err) {
    // Don't block if settings fail
  }
  next();
});

// === ROUTES WITH SPECIFIC LIMITERS ===
const requireAuth = require('./middleware/requireAuth');

// Auth routes (with strict limiting)
app.use('/api/auth', authLimiter, require('./routes/auth'));

// License (with activation limit)
app.use('/api/license', requireAuth, activationLimiter, require('./routes/license'));

// Redeem
app.use('/api/redeem', requireAuth, require('./routes/redeem'));

// Teacher routes
app.use('/api/teacher', requireAuth, require('./routes/teacher'));

// Student routes
app.use('/api/student', requireAuth, require('./routes/student'));

// AI (with AI-specific limiting)
app.use('/api/ai', requireAuth, aiLimiter, require('./routes/ai'));

// Feedback
app.use('/api/feedback', requireAuth, require('./routes/feedback'));

// Circles
app.use('/api/circles', requireAuth, require('./routes/circles'));

// Payment (public with payment limiter)
app.use('/api/payment', paymentLimiter, require('./routes/payment'));

// Admin (protected by rolling gateway)
app.use('/api/admin', require('./routes/admin'));

// Other routes
app.use('/api/quotes', requireAuth, require('./routes/quotes'));
app.use('/api/system', require('./routes/system'));

// === PUBLIC HEALTH CHECK ===
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

// === ANNOUNCEMENTS (public) ===
app.get('/api/announcements/active', async (req, res) => {
  try {
    const Announcement = require('./models/Announcement');
    const announcement = await Announcement.findOne({
      isActive: true,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    })
    .select('text target createdAt')
    .lean();
    res.json({
      success: true,
      data: { announcement }
    });
  } catch (err) {
    res.json({
      success: true,
      data: { announcement: null }
    });
  }
});

// === 404 HANDLER ===
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found.',
    error: { code: 'NOT_FOUND' }
  });
});

// === GLOBAL ERROR HANDLER ===
app.use((err, req, res, next) => {
  logger.error(err.message, {
    requestId: req.id,
    path: req.originalUrl,
    ip: req.ip,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'Access denied.',
      error: { code: 'CORS_BLOCKED' }
    });
  }

  const message = process.env.NODE_ENV === 'development'
    ? err.message
    : 'Something went wrong.';

  res.status(err.status || 500).json({
    success: false,
    message,
    error: {
      code: err.code || 'SERVER_ERROR',
      requestId: req.id
    }
  });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  logger.info(`BEEPREPARE running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  logger.error('Unhandled Rejection:', {
    message: reason?.message || reason,
    stack: reason?.stack
  });
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  logger.error('Uncaught Exception:', {
    message: err.message,
    stack: err.stack
  });
  process.exit(1);
});
