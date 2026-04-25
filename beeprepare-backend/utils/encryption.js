/**
 * BEEPREPARE — FIELD-LEVEL ENCRYPTION UTILITY
 * AES-256-GCM encryption for sensitive data at rest.
 * Use this to encrypt PII fields (email for lookup hash, UTR numbers,
 * payment details) stored in MongoDB.
 *
 * DROP THIS FILE in: beeprepare-backend/utils/encryption.js
 *
 * USAGE:
 *   const { encrypt, decrypt, hashForLookup } = require('./encryption');
 *
 *   // Storing:
 *   doc.utrNumber = encrypt(rawUTR);
 *
 *   // Reading:
 *   const rawUTR = decrypt(doc.utrNumber);
 *
 *   // Searching by email (store hash alongside encrypted value):
 *   doc.emailHash = hashForLookup(email);
 *   User.findOne({ emailHash: hashForLookup(searchEmail) });
 */

'use strict';

const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;   // 96-bit IV (GCM standard)
const TAG_LEN = 16;  // 128-bit auth tag

// Derive a 32-byte key from env secret using PBKDF2
// We do this once at startup — never hardcode the key.
const _deriveKey = () => {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[ENCRYPTION] ENCRYPTION_SECRET must be at least 32 chars in production');
    }
    console.warn('[ENCRYPTION] WARNING: ENCRYPTION_SECRET missing or weak — using unsafe fallback');
    return crypto.scryptSync('UNSAFE_DEV_FALLBACK_DO_NOT_USE', 'beeprepare_salt_v1', 32);
  }
  return crypto.scryptSync(secret, 'beeprepare_field_encryption_salt_v1', 32);
};

let _key;
const getKey = () => {
  if (!_key) _key = _deriveKey();
  return _key;
};

// ── Encrypt ───────────────────────────────────────────────────────

/**
 * Encrypts a plaintext string.
 * Returns a base64url-encoded string: iv:ciphertext:tag
 */
const encrypt = (plaintext) => {
  if (plaintext === null || plaintext === undefined) return plaintext;
  const text = String(plaintext);

  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  // Format: base64url(iv) + ':' + base64url(encrypted) + ':' + base64url(tag)
  return [
    iv.toString('base64url'),
    encrypted.toString('base64url'),
    tag.toString('base64url')
  ].join(':');
};

// ── Decrypt ───────────────────────────────────────────────────────

/**
 * Decrypts a value produced by encrypt().
 * Returns original plaintext string.
 */
const decrypt = (encryptedValue) => {
  if (!encryptedValue || typeof encryptedValue !== 'string') return encryptedValue;

  // If it doesn't look encrypted (no colons), return as-is (migration safety)
  const parts = encryptedValue.split(':');
  if (parts.length !== 3) return encryptedValue;

  try {
    const [ivB64, dataB64, tagB64] = parts;
    const iv = Buffer.from(ivB64, 'base64url');
    const data = Buffer.from(dataB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');

    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);

    return decipher.update(data) + decipher.final('utf8');
  } catch (err) {
    console.error('[ENCRYPTION] Decryption failed:', err.message);
    throw new Error('Decryption failed — data may be corrupt or key rotated');
  }
};

// ── Deterministic Hash for Lookup ─────────────────────────────────

/**
 * Creates a searchable HMAC hash of a value (e.g., email, phone).
 * Use this alongside the encrypted value to enable lookups without decrypting.
 *
 * Example MongoDB schema:
 *   email: String,         ← encrypted
 *   emailHash: String,     ← HMAC hash for .findOne({ emailHash })
 */
const LOOKUP_SECRET = process.env.LOOKUP_HMAC_SECRET || process.env.ADMIN_JWT_SECRET || 'fallback';

const hashForLookup = (value) => {
  if (!value) return null;
  return crypto
    .createHmac('sha256', LOOKUP_SECRET)
    .update(String(value).toLowerCase().trim())
    .digest('base64url');
};

// ── Encryption Middleware ─────────────────────────────────────────

/**
 * Mongoose plugin: automatically encrypts specified fields before save
 * and decrypts after find.
 *
 * USAGE in model:
 *   const { encryptionPlugin } = require('../utils/encryption');
 *   PaymentSchema.plugin(encryptionPlugin, { fields: ['utrNumber', 'email'] });
 */
const encryptionPlugin = (schema, options = {}) => {
  const fields = options.fields || [];

  schema.pre('save', function (next) {
    for (const field of fields) {
      if (this.isModified(field) && this[field]) {
        // Store hash for lookupable fields
        if (options.hashFields?.includes(field)) {
          this[`${field}Hash`] = hashForLookup(this[field]);
        }
        this[field] = encrypt(this[field]);
      }
    }
    next();
  });

  // Decrypt after any query returning documents
  const decryptDoc = (doc) => {
    if (!doc) return;
    for (const field of fields) {
      if (doc[field]) {
        try {
          doc[field] = decrypt(doc[field]);
        } catch (_) {
          // Don't crash reads if one field fails
        }
      }
    }
  };

  schema.post('find', function (docs) {
    if (Array.isArray(docs)) docs.forEach(decryptDoc);
  });
  schema.post('findOne', decryptDoc);
  schema.post('findOneAndUpdate', decryptDoc);
};

// ── Key Rotation Helper ───────────────────────────────────────────

/**
 * Re-encrypts a value with the current key.
 * Use during key rotation to migrate encrypted fields.
 *
 * const reencrypted = reEncrypt(oldEncryptedValue, oldKey);
 */
const reEncrypt = (encryptedValue, _oldKeyUnused) => {
  // Decrypt with current key, re-encrypt with current key
  // In a real rotation: pass oldKey as parameter and use it to decrypt
  const plain = decrypt(encryptedValue);
  return encrypt(plain);
};

module.exports = {
  encrypt,
  decrypt,
  hashForLookup,
  encryptionPlugin,
  reEncrypt,
};
