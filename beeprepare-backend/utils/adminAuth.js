const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const getAdminAccounts = () => [
  {
    id: process.env.ADMIN_1_ID,
    password: process.env.ADMIN_1_PASS
  },
  {
    id: process.env.ADMIN_2_ID,
    password: process.env.ADMIN_2_PASS
  },
  {
    id: process.env.ADMIN_3_ID,
    password: process.env.ADMIN_3_PASS
  }
];

const verifyAdminCredentials = (id, password) => {
  const accounts = getAdminAccounts();
  const admin = accounts.find(
    a => a.id === id
  );
  if (!admin) return false;
  
  // Use bcrypt for secure comparison if passwords in .env are hashed
  // For now, if they are plain text, we keep === but recommend hashing
  // If they start with $2b$, we use bcrypt
  if (admin.password.startsWith('$2b$')) {
    return bcrypt.compareSync(password, admin.password);
  }
  return admin.password === password;
};

const generateAdminToken = (adminId) => {
  return jwt.sign(
    { adminId, role: 'admin',
      timestamp: Date.now() },
    process.env.ADMIN_JWT_SECRET,
    { expiresIn: process.env.ADMIN_SESSION_EXPIRY
      || '8h' }
  );
};

const verifyAdminToken = (token) => {
  try {
    return jwt.verify(
      token,
      process.env.ADMIN_JWT_SECRET
    );
  } catch (err) {
    return null;
  }
};

const verifyActionCode = (action, code) => {
  if (!action || !code) return false;

  const codeMap = {
    'block_user':
      process.env.CODE_BLOCK_USER,
    'unblock_user':
      process.env.CODE_UNBLOCK_USER,
    'delete_user':
      process.env.CODE_DELETE_USER,
    'approve_payment':
      process.env.CODE_APPROVE_PAYMENT,
    'reject_payment':
      process.env.CODE_REJECT_PAYMENT,
    'generate_keys':
      process.env.CODE_GENERATE_KEYS,
    'delete_feedback':
      process.env.CODE_DELETE_FEEDBACK,
    'deactivate_bank':
      process.env.CODE_DEACTIVATE_BANK,
    'delete_bank':
      process.env.CODE_DELETE_BANK,
    'maintenance_on':
      process.env.CODE_MAINTENANCE_ON,
    'maintenance_off':
      process.env.CODE_MAINTENANCE_OFF,
    'change_mongodb':
      process.env.CODE_CHANGE_MONGODB,
    'change_gemini':
      process.env.CODE_CHANGE_GEMINI,
    'change_resend':
      process.env.CODE_CHANGE_RESEND,
    'change_cors':
      process.env.CODE_CHANGE_CORS,
    'clear_logs':
      process.env.CODE_CLEAR_LOGS,
    'restart_server':
      process.env.CODE_RESTART_SERVER,
    'change_admin_pass':
      process.env.CODE_CHANGE_ADMIN_PASS,
    'mark_feedback':
      process.env.CODE_MARK_FEEDBACK,
    'force_reset':
      process.env.CODE_FORCE_RESET,
    'delete_key':
      process.env.CODE_DELETE_KEY,
    'delete_payment':
      process.env.CODE_DELETE_PAYMENT,
    'add_blacklist':
      process.env.CODE_BLOCK_USER,
    'bulk_upload':
      process.env.CODE_BULK_UPLOAD,
    'manage_blacklist': 
      process.env.CODE_BLOCK_USER
  };

  const expected = codeMap[action];
  if (!expected) return false;

  return expected.trim() === code.trim();
};

module.exports = {
  verifyAdminCredentials,
  generateAdminToken,
  verifyAdminToken,
  verifyActionCode
};
