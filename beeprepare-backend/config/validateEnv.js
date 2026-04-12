const required = [
  'PORT',
  'MONGODB_URI',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'BCRYPT_SALT_ROUNDS',
  'OTP_EXPIRY_HOURS',
  'MAX_OTP_ATTEMPTS',
  'SIGNED_URL_EXPIRY_SECONDS',
  'GEMINI_API_KEY',
  'NODE_ENV',
  'ALLOWED_ORIGINS',
  'MAX_REQUEST_SIZE'
];

const validateEnv = () => {
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('Server cannot start. Add missing variables to .env');
    process.exit(1);
  }
  console.log('✅ Environment variables validated');
};

module.exports = validateEnv;
