const crypto = require('crypto');

/**
 * Generates a deterministic, unique ID for a chapter based on its metadata.
 * Uses MD5 hashing to prevent collisions when names are similar or long.
 * Returns a 24-character hex string.
 */
const getChapterId = (className, subject, chapterName) => {
  if (!className || !subject || !chapterName) return null;
  
  const normalizedClass = className.startsWith('Class ') ? className : `Class ${className}`;
  const key = `${normalizedClass}-${subject}`;
  const fullStr = `${key}-${chapterName.trim()}`;
  
  // Use MD5 for a deterministic hash, then slice to 24 chars
  return crypto.createHash('md5').update(fullStr).digest('hex').slice(0, 24);
};

module.exports = getChapterId;
