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
  'CODE_BLOCK_USER',
  'CODE_APPROVE_PAYMENT',
  'CODE_GENERATE_KEYS',
  'CODE_MAINTENANCE_ON',
  'CODE_MAINTENANCE_OFF',
  'CODE_DELETE_USER'
];

const validateEnv = () => {
  const missing = required.filter(key => {
    const val = process.env[key];
    return !val || val === '';
  });
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('Server cannot start. Add missing variables to .env');
    process.exit(1);
  }
  console.log('✅ Environment variables validated');
};

module.exports = validateEnv;
