const required = [
  'PORT', 'NODE_ENV',
  'MONGODB_URI', 'MONGODB_QUESTIONS_URI',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'BCRYPT_SALT_ROUNDS',
  'OTP_EXPIRY_HOURS',
  'MAX_OTP_ATTEMPTS',
  'SIGNED_URL_EXPIRY_SECONDS',
  'GEMINI_API_KEY',
  'ALLOWED_ORIGINS',
  'MAX_REQUEST_SIZE',
  'ADMIN_JWT_SECRET',
  'ADMIN_1_ID', 'ADMIN_1_PASS',
  'ADMIN_2_ID', 'ADMIN_2_PASS',
  'ADMIN_3_ID', 'ADMIN_3_PASS',
  'RESEND_API_KEY',
  'UPI_ID', 'UPI_NAME',
  'ACTIVATION_PRICE',
  'EXTRA_SLOT_PRICE',
  'ADMIN_GATE_KEY',
  'ADMIN_ENTRY_SECRET',
  // Action codes — all required
  'CODE_BLOCK_USER',
  'CODE_UNBLOCK_USER',
  'CODE_APPROVE_PAYMENT',
  'CODE_REJECT_PAYMENT',
  'CODE_GENERATE_KEYS',
  'CODE_MAINTENANCE_ON',
  'CODE_MAINTENANCE_OFF',
  'CODE_DELETE_USER',
  'CODE_FORCE_RESET',
  'CODE_DELETE_KEY',
  'CODE_DELETE_PAYMENT',
  'CODE_CLEAR_LOGS',
  'CODE_RESTART_SERVER',
  'CODE_MARK_FEEDBACK',
  'CODE_DELETE_FEEDBACK',
  'CODE_DEACTIVATE_BANK',
  'CODE_DELETE_BANK',
  'CODE_ADD_ANNOUNCEMENT',
  // NEW — Fortress security layer
  'ENCRYPTION_SECRET',
  'LOOKUP_HMAC_SECRET',
];

const validateEnv = () => {
  const isProd = process.env.NODE_ENV === 'production';

  // ── 1. Missing variables ──────────────────────────────────────
  const missing = required.filter(key => {
    const val = process.env[key];
    return !val || val === '';
  });
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('Server attempting to start despite missing variables (Serverless Mode).');
    if (!process.env.VERCEL) process.exit(1);
  }

  if (isProd) {
    // ── 2. Secret strength checks ───────────────────────────────
    const weakSecrets = ['ADMIN_JWT_SECRET', 'ENCRYPTION_SECRET', 'LOOKUP_HMAC_SECRET']
      .filter(k => (process.env[k] || '').length < 32);
    if (weakSecrets.length > 0) {
      console.error('❌ Weak secrets (must be 32+ chars):');
      weakSecrets.forEach(k => console.error(`   - ${k}`));
      if (!process.env.VERCEL) process.exit(1);
    }

    // ── 3. Block known-compromised values ───────────────────────
    const KNOWN_COMPROMISED = ['BeeAdminJWT#9x7K2619Delta'];
    if (KNOWN_COMPROMISED.includes(process.env.ADMIN_JWT_SECRET)) {
      console.error('🚨 CRITICAL: ADMIN_JWT_SECRET is a known-compromised value! Rotate it immediately.');
      if (!process.env.VERCEL) process.exit(1);
    }

    // ── 4. No wildcard CORS in production ───────────────────────
    const origins = process.env.ALLOWED_ORIGINS || '';
    if (origins === '*' || origins.includes('*')) {
      console.error('❌ ALLOWED_ORIGINS cannot use wildcard (*) in production!');
      if (!process.env.VERCEL) process.exit(1);
    }

    // ── 5. Action code uniqueness ────────────────────────────────
    const codes = [
      'CODE_BLOCK_USER','CODE_UNBLOCK_USER','CODE_DELETE_USER',
      'CODE_APPROVE_PAYMENT','CODE_REJECT_PAYMENT','CODE_GENERATE_KEYS',
      'CODE_MAINTENANCE_ON','CODE_MAINTENANCE_OFF','CODE_DELETE_KEY',
      'CODE_DELETE_PAYMENT','CODE_FORCE_RESET','CODE_CLEAR_LOGS',
      'CODE_RESTART_SERVER','CODE_MARK_FEEDBACK','CODE_DELETE_FEEDBACK',
      'CODE_DEACTIVATE_BANK','CODE_DELETE_BANK'
    ].map(k => process.env[k]).filter(Boolean);
    if (new Set(codes).size < codes.length) {
      console.error('❌ SECURITY: All action codes must be unique — duplicates detected!');
      if (!process.env.VERCEL) process.exit(1);
    }

    // ── 6. Firebase private key format ──────────────────────────
    if (!process.env.FIREBASE_PRIVATE_KEY.includes('-----BEGIN')) {
      console.error('⚠️  FIREBASE_PRIVATE_KEY does not look like a valid PEM key.');
      console.error('   Ensure newlines are escaped as \\n in the .env file.');
    }
  }

  console.log('✅ Environment variables validated');
};

module.exports = validateEnv;
