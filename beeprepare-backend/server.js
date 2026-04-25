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
const compression = require('compression');

const {
  securityHeaders,
  requestTracker,
  sanitizeInput,
  blockSuspiciousRequests,
  sanitizeResponse
} = require('./middleware/security');

// ═══ FORTRESS — Advanced Security Layer ═══
const { fortressStack } = require('./middleware/fortress');
const { csrfTokenEndpoint } = require('./middleware/csrf');
const { ipShield } = require('./middleware/ipShield');

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
const requireAuth = require('./middleware/requireAuth');


// === SYSTEM CONFIG ===
app.set('trust proxy', 1);

// ═══════════════════════════════════════════════════════════════
// AUTOMATED IP SHIELD — 1st Line of Defense
// ═══════════════════════════════════════════════════════════════
app.use(ipShield);

// === COMPRESSION — SPEED OPTIMIZATION ===
app.use(compression());

// === CORS — LOCKED DOWN ===
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-CSRF-Token', 'Idempotency-Key']
}));

// ═══════════════════════════════════════════════════════════════
// FORTRESS — 12-Layer Security Stack (MUST be first middleware)
// Blocks: SQLi, NoSQLi, XSS, SSTI, XXE, Command Injection,
//         Path Traversal, Prototype Pollution, Header Injection,
//         JSON Bombs, Scanner Bots, URL Overflow, Hard-blocked IPs
// ═══════════════════════════════════════════════════════════════
app.use(fortressStack);

// === SECURITY HEADERS FIRST ===
app.use(securityHeaders);

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

// === CSRF TOKEN ENDPOINT ===
// Admin panel calls GET /api/csrf-token before any state-changing request
app.get('/api/csrf-token', requireAuth, csrfTokenEndpoint);
app.get('/api/admin-csrf-token', csrfTokenEndpoint); // Admin uses this (no user auth)

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
              <h1>Access Denied</h1>
              <p>Matrix Node Entry Requires Authorized Key.</p>
          </div>
      </body>
      </html>
    `);
  }
  const currentCode = getRollingSecret(0);
  res.redirect(`/gate/${currentCode}/index.html`);
});

// Vault Login Handler (Firebase ID Token Verify)
app.post('/api/admin-security/vault-login', async (req, res) => {
    const { idToken } = req.body;
    const admin = require('firebase-admin');
    const ALLOWED_EMAILS = [
        'ravindarraodevarneni@gmail.com',
        'vcccricket7@gmail.com'
    ];

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const email = decodedToken.email;

        if (!ALLOWED_EMAILS.includes(email)) {
            return res.status(403).json({ success: false, message: 'UNAUTHORIZED_EMAIL' });
        }

        const { getActiveCredentials } = require('./utils/adminAuth');
        const creds = await getActiveCredentials();

        res.json({ success: true, data: creds });
    } catch (err) {
        res.status(401).json({ success: false, message: 'INVALID_TOKEN' });
    }
});

app.get('/vault', async (req, res) => {
  const key = req.query.key;
  const vaultKey = process.env.ADMIN_VAULT_KEY || 'BEE_VAULT_DEFAULT_SECRET';
  
  if (!key || key !== vaultKey) {
    return res.status(403).send('UNAUTHORIZED_VAULT_ACCESS');
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>BEE Vault | Security Node</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
            body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #000; color: #fff; font-family: 'Outfit', sans-serif; }
            .card { background: rgba(18, 18, 18, 0.8); backdrop-filter: blur(20px); padding: 40px; border-radius: 40px; border: 1px solid rgba(255, 215, 0, 0.2); text-align: center; max-width: 420px; width: 90%; }
            h1 { color: #FFD700; font-size: 28px; margin-bottom: 10px; font-weight: 900; }
            p { color: #888; font-size: 14px; margin-bottom: 30px; }
            .google-btn { background: #fff; color: #000; border: none; width: 100%; padding: 16px; border-radius: 14px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 12px; transition: 0.3s; margin-top: 20px; }
            .google-btn:hover { background: #FFD700; transform: translateY(-3px); }
            .creds-container { display: none; text-align: left; margin-top: 20px; }
            .item { background: rgba(255,255,255,0.03); padding: 15px; border-radius: 15px; border: 1px solid rgba(255,215,0,0.1); margin-bottom: 15px; }
            label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 2px; display: block; margin-bottom: 5px; }
            .val { font-size: 18px; font-weight: 800; color: #fff; font-family: monospace; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>Matrix Vault</h1>
            <p id="status-msg">Identity Verification Required</p>
            
            <button id="login-btn" class="google-btn">
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20">
                Authorize with Google
            </button>

            <div id="creds-box" class="creds-container">
                <div class="item">
                    <label>Admin ID</label>
                    <div id="admin-id" class="val">---</div>
                </div>
                <div class="item">
                    <label>Security Key</label>
                    <div id="admin-pass" class="val">---</div>
                </div>
                <p style="font-size: 11px; color: #FFD700; text-align: center; margin-top: 10px;">Dynamic credentials active (30m).</p>
            </div>
        </div>

        <script type="module">
            import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
            import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, setPersistence, inMemoryPersistence } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

            const firebaseConfig = {
                apiKey: "AIzaSyBUTRNqsbkzLVpYs7oCt1v335PVuomdQ_0",
                authDomain: "beeprepare-1d7b8.firebaseapp.com",
                projectId: "beeprepare-1d7b8",
                storageBucket: "beeprepare-1d7b8.firebasestorage.app",
                messagingSenderId: "221629340476",
                appId: "1:221629340476:web:b9fd677eb5ee0984721c39"
            };

            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);

            // Set strict persistence and sign out to force fresh login
            try {
                await setPersistence(auth, inMemoryPersistence);
                await signOut(auth);
            } catch(e) { console.warn("Persistence init failed", e); }

            document.getElementById('login-btn').addEventListener('click', async () => {
                const btn = document.getElementById('login-btn');
                btn.disabled = true;
                btn.textContent = "Verifying...";
                
                try {
                    const provider = new GoogleAuthProvider();
                    provider.setCustomParameters({ prompt: 'select_account' }); // Always show account picker
                    
                    const result = await signInWithPopup(auth, provider);
                    const idToken = await result.user.getIdToken();

                    const res = await fetch('/api/admin-security/vault-login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ idToken })
                    });
                    
                    const data = await res.json();
                    if (data.success) {
                        btn.style.display = 'none';
                        document.getElementById('status-msg').textContent = "Identity Confirmed: " + result.user.email;
                        document.getElementById('status-msg').style.color = "#4CAF50";
                        document.getElementById('creds-box').style.display = 'block';
                        document.getElementById('admin-id').textContent = data.data.id;
                        document.getElementById('admin-pass').textContent = data.data.pass;
                    } else {
                        throw new Error(data.message || 'Access Denied');
                    }
                } catch (err) {
                    alert(err.message === 'UNAUTHORIZED_EMAIL' ? "CRITICAL: Email Not in Authorized List." : "Identity Verification Failed.");
                    btn.disabled = false;
                    btn.textContent = "Authorize with Google";
                }
            });
        </script>
    </body>
    </html>
  `);
});

app.use('/assets', express.static(path.resolve(__dirname, '../assets')));
app.use('/gate/:code', (req, res, next) => {
  const code = req.params.code;
  const current = getRollingSecret(0);
  const previous = getRollingSecret(-1);
  if (code === current || code === previous) {
    return next();
  }
  res.status(404).send('<h1>🔍 Node Not Found</h1><p>Expired or invalid path.</p>');
}, express.static(path.resolve(__dirname, `../${process.env.ADMIN_FOLDER_NAME || 'matrix-core-v1419'}`)));

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

// === ROUTES WITH RATE LIMITING ===

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

// Payment (public submit with payment limiter + full security stack; status/resend locked)
app.use('/api/payment', paymentLimiter, require('./routes/payment'));

// Admin (protected by rolling gateway)
app.use('/api/admin', require('./routes/admin'));

// CAPTCHA Generation
app.get('/api/admin-security/captcha', (req, res) => {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  const sum = num1 + num2;
  
  // Store the result in a temporary signed token
  const captchaToken = crypto.createHmac('sha256', process.env.ADMIN_JWT_SECRET)
    .update(`${sum}-${Date.now() + 5 * 60 * 1000}`) // Valid for 5 mins
    .digest('hex');
    
  res.json({
    success: true,
    data: {
      question: `What is ${num1} + ${num2}?`,
      token: `${captchaToken}:${sum}:${Date.now() + 5 * 60 * 1000}`
    }
  });
});

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
  const requestId = req.id || 'unknown';
  logger.error(err.message, {
    requestId,
    path: req.originalUrl,
    ip: req.ip,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  const message = process.env.NODE_ENV === 'development'
    ? err.message
    : 'A secure server error occurred.';

  // Ensure we ALWAYS return JSON
  res.status(err.status || 500).json({
    success: false,
    message,
    error: {
      code: err.code || 'SERVER_ERROR',
      requestId
    }
  });
});

const PORT = process.env.PORT || 5000;

// === STARTUP SEQUENCE — CONNECT DB THEN LISTEN ===
const startApp = async () => {
  try {
    // Only block startup on DB failure if NOT on Vercel
    // On Vercel, we want the function to stay alive to report errors
    await connectDB().catch(err => {
        logger.error('DB CONNECTION DELAYED OR FAILED:', err);
    });

    if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
        const server = app.listen(PORT, () => {
          logger.info(`BEEPREPARE running on port ${PORT}`);
        });

        process.on('SIGTERM', () => {
          server.close(() => process.exit(0));
        });
    }
  } catch (err) {
    logger.error('CRITICAL STARTUP FAILURE:', err);
  }
};

startApp();

module.exports = app;

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
