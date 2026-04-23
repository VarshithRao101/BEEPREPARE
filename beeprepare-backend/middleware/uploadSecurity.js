const path = require('path');
const { error } = require('../utils/responseHelper');

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png'
];

const ALLOWED_EXTENSIONS = [
  '.pdf', '.jpg', '.jpeg', '.png'
];

const MAX_SIZES = {
  complete: 7 * 1024 * 1024,  // 7MB
  short: 4 * 1024 * 1024,     // 4MB
  image: 2 * 1024 * 1024      // 2MB
};

// Validate file upload
const validateUpload = (req, res, next) => {
  if (!req.file) return next();

  const file = req.file;
  const ext = path.extname(file.originalname).toLowerCase();

  // Check extension
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return error(res,
      `File type not allowed. Allowed: PDF, JPG, PNG`,
      'INVALID_FILE_TYPE', 400);
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return error(res,
      'Invalid file format.',
      'INVALID_MIME_TYPE', 400);
  }

  // Check for double extension
  // (file.pdf.exe type attacks)
  const name = file.originalname.toLowerCase();
  const dangerousExtensions = [
    '.exe', '.sh', '.bat', '.cmd',
    '.ps1', '.vbs', '.js', '.php',
    '.py', '.rb', '.pl'
  ];
  if (dangerousExtensions.some(e => name.includes(e))) {
    return error(res,
      'Suspicious file detected.',
      'SUSPICIOUS_FILE', 400);
  }

  // Check file size based on type
  const noteType = req.body.noteType || 'short';
  const maxSize = noteType === 'complete'
    ? MAX_SIZES.complete
    : MAX_SIZES.short;

  if (file.size > maxSize) {
    const maxMB = (maxSize / (1024 * 1024)).toFixed(0);
    return error(res,
      `File too large. Max ${maxMB}MB.`,
      'FILE_TOO_LARGE', 400);
  }

  // Check file is not empty
  if (file.size === 0) {
    return error(res,
      'File is empty.',
      'EMPTY_FILE', 400);
  }

  next();
};

// Sanitize filename
const sanitizeFilename = (filename) => {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 100);
};

module.exports = {
  validateUpload,
  sanitizeFilename
};
