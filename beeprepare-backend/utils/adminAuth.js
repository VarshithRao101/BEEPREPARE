const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const SystemConfig = require('../models/SystemConfig');

/**
 * GENERATE / RETRIEVE DYNAMIC CREDENTIALS
 * This is the ONLY way to login now.
 */
const getActiveCredentials = async () => {
    // 1. Try to find existing active creds
    let config = await SystemConfig.findOne({ key: 'ACTIVE_ADMIN_CREDS' });
    
    const now = Date.now();
    // 2. If missing or older than 30 minutes, generate FRESH ones
    if (!config || (now - new Date(config.updatedAt).getTime() > 30 * 60 * 1000)) {
        const id = `BEE_ID_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const pass = crypto.randomBytes(8).toString('hex');
        
        config = await SystemConfig.findOneAndUpdate(
            { key: 'ACTIVE_ADMIN_CREDS' },
            { 
                value: { id, pass },
                updatedBy: 'SYSTEM_ROTATION'
            },
            { upsert: true, new: true }
        );
        console.log(`[SECURITY] Fresh Admin Credentials Generated: ${id}`);
    }
    
    return config.value;
};

const verifyAdminCredentials = async (id, password) => {
  const active = await getActiveCredentials();
  
  if (id === active.id && password === active.pass) {
    return { id: active.id, role: 'admin', type: 'dynamic' };
  }
  
  return null;
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
    'block_user': process.env.CODE_BLOCK_USER,
    'unblock_user': process.env.CODE_UNBLOCK_USER,
    'delete_user': process.env.CODE_DELETE_USER,
    'approve_payment': process.env.CODE_APPROVE_PAYMENT,
    'reject_payment': process.env.CODE_REJECT_PAYMENT,
    'generate_keys': process.env.CODE_GENERATE_KEYS,
    'delete_feedback': process.env.CODE_DELETE_FEEDBACK,
    'deactivate_bank': process.env.CODE_DEACTIVATE_BANK,
    'delete_bank': process.env.CODE_DELETE_BANK,
    'maintenance_on': process.env.CODE_MAINTENANCE_ON,
    'maintenance_off': process.env.CODE_MAINTENANCE_OFF,
    'change_mongodb': process.env.CODE_CHANGE_MONGODB,
    'change_gemini': process.env.CODE_CHANGE_GEMINI,
    'change_resend': process.env.CODE_CHANGE_RESEND,
    'change_cors': process.env.CODE_CHANGE_CORS,
    'clear_logs': process.env.CODE_CLEAR_LOGS,
    'restart_server': process.env.CODE_RESTART_SERVER,
    'change_admin_pass': process.env.CODE_CHANGE_ADMIN_PASS,
    'mark_feedback': process.env.CODE_MARK_FEEDBACK,
    'force_reset': process.env.CODE_FORCE_RESET,
    'delete_key': process.env.CODE_DELETE_KEY,
    'delete_payment': process.env.CODE_DELETE_PAYMENT,
    'bulk_upload': process.env.CODE_BULK_UPLOAD,
    'manage_blacklist': process.env.CODE_BLOCK_USER,
    'add_announcement': process.env.CODE_ADD_ANNOUNCEMENT
  };

  const expected = codeMap[action];
  if (!expected) return false;

  return expected.trim() === code.trim();
};

module.exports = {
  getActiveCredentials,
  verifyAdminCredentials,
  generateAdminToken,
  verifyAdminToken,
  verifyActionCode
};
