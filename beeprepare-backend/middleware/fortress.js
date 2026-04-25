/**
 * ██████╗ ███████╗███████╗██████╗ ██████╗ ███████╗██████╗  █████╗ ██████╗ ███████╗
 * ██╔══██╗██╔════╝██╔════╝██╔══██╗██╔══██╗██╔════╝██╔══██╗██╔══██╗██╔══██╗██╔════╝
 * ██████╔╝█████╗  █████╗  ██████╔╝██████╔╝█████╗  ██████╔╝███████║██████╔╝█████╗
 * ██╔══██╗██╔══╝  ██╔══╝  ██╔═══╝ ██╔══██╗██╔══╝  ██╔═══╝ ██╔══██║██╔══██╗██╔══╝
 * ██████╔╝███████╗███████╗██║     ██║  ██║███████╗██║     ██║  ██║██║  ██║███████╗
 * ╚═════╝ ╚══════╝╚══════╝╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝
 *
 * BEEPREPARE — FORTRESS SECURITY LAYER v2.0
 * Complete security hardening: injection prevention, anomaly detection,
 * fingerprinting, payload validation, and behavioral analysis.
 *
 * DROP THIS FILE in: beeprepare-backend/middleware/fortress.js
 * IMPORT IT in server.js BEFORE all routes.
 */

'use strict';

const crypto = require('crypto');
const logger = require('../utils/logger');
const { recordStrike } = require('./ipShield');

// ═══════════════════════════════════════════════════════════════════
// § 1. THREAT INTELLIGENCE — Pattern libraries
// ═══════════════════════════════════════════════════════════════════

const INJECTION_PATTERNS = {
  // NoSQL / MongoDB injection
  nosql: [
    /\$where/i, /\$gt\b/i, /\$lt\b/i, /\$ne\b/i, /\$in\b/i,
    /\$nin\b/i, /\$or\b/i, /\$and\b/i, /\$not\b/i, /\$nor\b/i,
    /\$exists\b/i, /\$type\b/i, /\$regex\b/i, /\$elemMatch/i,
    /\$size\b/i, /\$all\b/i, /\$slice\b/i, /\$lookup/i,
    /mapReduce/i, /\$function/i, /\$accumulator/i
  ],
  // SQL Injection (even though you use MongoDB, some inputs may be passed to logs or other systems)
  sql: [
    /(\bUNION\b.*\bSELECT\b)/i,
    /(\bSELECT\b.*\bFROM\b)/i,
    /(\bINSERT\b.*\bINTO\b)/i,
    /(\bDROP\b.*\bTABLE\b)/i,
    /(\bDELETE\b.*\bFROM\b)/i,
    /(\bUPDATE\b.*\bSET\b)/i,
    /(\'|\")\s*(OR|AND)\s*(\'|\"|\d)/i,
    /--\s*$/m,
    /\/\*.*\*\//s,
    /;\s*(DROP|DELETE|INSERT|UPDATE|SELECT|CREATE|ALTER)/i,
    /\bEXEC\b.*\(/i,
    /\bEXECUTE\b.*\(/i,
    /\bxp_cmdshell\b/i,
    /\bsp_executesql\b/i,
    /WAITFOR\s+DELAY/i,
    /SLEEP\s*\(/i
  ],
  // XSS patterns
  xss: [
    /<script[\s>]/i,
    /<\/script>/i,
    /javascript\s*:/i,
    /vbscript\s*:/i,
    /on(load|error|click|mouse|key|focus|blur|change|submit|reset|select|abort|drag|drop|scroll|hash|storage|message|pop|unload|before)\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<form/i,
    /<input.*type\s*=\s*['"]?hidden/i,
    /data\s*:\s*text\/html/i,
    /expression\s*\(/i,
    /<svg.*on\w+/i,
    /&#x[0-9a-f]+;/i,
    /&#\d+;.*script/i,
    /\u0000/, // null byte
  ],
  // Command injection
  command: [
    /[;&|`$(){}[\]]/,         // Shell metacharacters
    /\|\s*(cat|ls|pwd|whoami|id|uname|wget|curl|nc|bash|sh|zsh|python|perl|ruby|php)/i,
    /`[^`]*`/,                 // Backtick execution
    /\$\([^)]*\)/,             // Command substitution
    /\beval\s*\(/i,
    /\bexec\s*\(/i,
    /\bspawn\s*\(/i,
    /\bfork\s*\(/i,
    /\bsystem\s*\(/i,
    /\/etc\/passwd/,
    /\/etc\/shadow/,
    /\/proc\/self/,
    /\.\.\/.*\.\.\//,          // Path traversal
    /\x00/,                    // Null bytes
  ],
  // LDAP injection
  ldap: [
    /[()\\*\x00]/,
    /\|\|/,
    /&&/,
  ],
  // XML / XXE
  xxe: [
    /<!ENTITY/i,
    /<!DOCTYPE/i,
    /SYSTEM\s+["']/i,
    /<!\[CDATA\[/i,
    /\bDOCTYPE\b.*\bSYSTEM\b/i,
  ],
  // Template injection (SSTI)
  ssti: [
    /\{\{.*\}\}/,              // Handlebars / Jinja2
    /\{%.*%\}/,                // Jinja2 tags
    /\$\{.*\}/,                // JS template literals in input
    /#{.*}/,                   // Ruby ERB
    /<%(=?|-).*%>/,            // ERB
    /@\{.*\}/,                 // Razor
  ],
  // HTTP Response Splitting
  headerInjection: [
    /\r\n/,
    /\r/,
    /\n/,
    /%0d%0a/i,
    /%0a/i,
    /%0d/i,
  ],
};

const SUSPICIOUS_UA_PATTERNS = [
  /sqlmap/i, /nikto/i, /nmap/i, /masscan/i, /dirbuster/i,
  /gobuster/i, /burpsuite/i, /havij/i, /acunetix/i, /nessus/i,
  /openvas/i, /w3af/i, /skipfish/i, /wapiti/i, /zap/i,
  /python-requests\/[01]\./i, /curl\/[0-6]\./i,
  /libwww-perl/i, /lwp-trivial/i, /lwp-request/i,
  /java\/1\.[0-6]/i, /go-http-client\/1\.0/i,
  /\bscanner\b/i, /\bfuzzer\b/i, /\bexploit\b/i,
];

const BLOCKED_PATHS = [
  '/\.env', '/\.git', '/\.svn', '/\.htaccess', '/\.htpasswd',
  '/wp-admin', '/wp-login', '/wp-config', '/phpmyadmin',
  '/admin/config', '/config/database', '/.well-known/security.txt',
  '/server-status', '/server-info', '/actuator', '/metrics',
  '/debug', '/trace', '/heap', '/threaddump',
  '/api/swagger', '/api/openapi', '/graphql', '/graphiql',
  '/\.bash_history', '/\.ssh', '/proc/self/environ',
];

// ═══════════════════════════════════════════════════════════════════
// § 2. THREAT DETECTION ENGINE
// ═══════════════════════════════════════════════════════════════════

/**
 * Deep-scan any value (string, array, object) for threat patterns.
 * Returns { threat: bool, type: string, matched: string }
 */
const deepScan = (value, path = '', depth = 0) => {
  if (value === null || value === undefined) return { threat: false };

  // Optimization: Cap depth to prevent recursion-based DoS and improve speed
  if (depth > 5) return { threat: false };

  if (typeof value === 'string') {
    // Decode common encoding tricks before scanning
    let decoded = value;
    try {
      decoded = decodeURIComponent(value);
    } catch (_) {}
    // Double-decode
    try {
      decoded = decodeURIComponent(decoded);
    } catch (_) {}
    // HTML entity decode (basic)
    decoded = decoded
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#x27;/gi, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));

    for (const [type, patterns] of Object.entries(INJECTION_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(decoded) || pattern.test(value)) {
          return { threat: true, type, matched: path, value: value.substring(0, 100) };
        }
      }
    }
    return { threat: false };
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const result = deepScan(value[i], `${path}[${i}]`, depth + 1);
      if (result.threat) return result;
    }
    return { threat: false };
  }

  if (typeof value === 'object') {
    for (const key of Object.keys(value)) {
      // MongoDB operator in key is always a threat
      if (key.startsWith('$') || key.includes('.')) {
        return { threat: true, type: 'nosql_key', matched: key };
      }
      // Prototype pollution attempt
      if (['__proto__', 'constructor', 'prototype'].includes(key)) {
        return { threat: true, type: 'prototype_pollution', matched: key };
      }
      const result = deepScan(value[key], `${path}.${key}`, depth + 1);
      if (result.threat) return result;
    }
    return { threat: false };
  }

  return { threat: false };
};

// ═══════════════════════════════════════════════════════════════════
// § 3. BEHAVIORAL ANOMALY TRACKER (in-memory, production use Redis)
// ═══════════════════════════════════════════════════════════════════

const anomalyStore = new Map();
const ANOMALY_WINDOW_MS = 60 * 1000; // 1 minute
const ANOMALY_THRESHOLD = 5;         // Max threats per window before hard block
const HARD_BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 min block

const hardBlockStore = new Map();

// Purge old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of anomalyStore.entries()) {
    if (now - data.firstSeen > ANOMALY_WINDOW_MS * 5) anomalyStore.delete(ip);
  }
  for (const [ip, unblockAt] of hardBlockStore.entries()) {
    if (now > unblockAt) hardBlockStore.delete(ip);
  }
}, 5 * 60 * 1000);

const recordAnomaly = (ip, type, requestId) => {
  const now = Date.now();
  if (!anomalyStore.has(ip)) {
    anomalyStore.set(ip, { count: 0, firstSeen: now, events: [] });
  }
  const record = anomalyStore.get(ip);
  // Reset window
  if (now - record.firstSeen > ANOMALY_WINDOW_MS) {
    record.count = 0;
    record.firstSeen = now;
    record.events = [];
  }
  record.count++;
  record.events.push({ type, requestId, at: now });

  // ═══════════════════════════════════════════════════════════════
  // PERSISTENT BAN SYSTEM
  // ═══════════════════════════════════════════════════════════════
  recordStrike(ip, `Security Anomaly: ${type}`);

  if (record.count >= ANOMALY_THRESHOLD) {
    hardBlockStore.set(ip, now + HARD_BLOCK_DURATION_MS);
    logger.warn('[FORTRESS] Hard-blocking IP after repeated threats', {
      ip, count: record.count, events: record.events
    });
    anomalyStore.delete(ip);
  }
};

const isHardBlocked = (ip) => {
  if (!hardBlockStore.has(ip)) return false;
  const unblockAt = hardBlockStore.get(ip);
  if (Date.now() > unblockAt) {
    hardBlockStore.delete(ip);
    return false;
  }
  return true;
};

// ═══════════════════════════════════════════════════════════════════
// § 4. REQUEST FINGERPRINTING
// ═══════════════════════════════════════════════════════════════════

const fingerprintRequest = (req) => {
  const components = [
    req.ip || '',
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || '',
    req.headers['accept'] || '',
  ];
  return crypto
    .createHash('sha256')
    .update(components.join('|'))
    .digest('hex')
    .substring(0, 16);
};

// ═══════════════════════════════════════════════════════════════════
// § 5. PAYLOAD INTEGRITY CHECKS
// ═══════════════════════════════════════════════════════════════════

const MAX_KEY_DEPTH = 6;
const MAX_KEY_COUNT = 50;

const validatePayloadStructure = (obj, depth = 0) => {
  if (depth > MAX_KEY_DEPTH) {
    return { valid: false, reason: 'Payload nesting too deep' };
  }
  if (typeof obj !== 'object' || obj === null) return { valid: true };

  const keys = Object.keys(obj);
  if (keys.length > MAX_KEY_COUNT) {
    return { valid: false, reason: 'Too many keys in payload' };
  }

  for (const key of keys) {
    if (key.length > 200) {
      return { valid: false, reason: 'Key name too long' };
    }
    const child = validatePayloadStructure(obj[key], depth + 1);
    if (!child.valid) return child;
  }
  return { valid: true };
};

// ═══════════════════════════════════════════════════════════════════
// § 6. EXPORTED MIDDLEWARE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * MIDDLEWARE 1: Hard Block Check
 * First gate — if an IP is already blocked, reject immediately.
 */
const hardBlockCheck = (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  if (isHardBlocked(ip)) {
    logger.warn('[FORTRESS] Hard-blocked IP attempted access', { ip, url: req.originalUrl });
    return res.status(429).json({
      success: false,
      message: 'Access temporarily suspended.',
      error: { code: 'IP_BLOCKED' }
    });
  }
  next();
};

/**
 * MIDDLEWARE 2: Blocked Path Guard
 * Blocks requests to known sensitive/attack-target paths.
 */
const blockedPathGuard = (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  const url = req.originalUrl.toLowerCase();
  for (const blocked of BLOCKED_PATHS) {
    if (url.includes(blocked.toLowerCase())) {
      const ip = req.ip;
      recordAnomaly(ip, 'blocked_path', req.id);
      logger.warn('[FORTRESS] Blocked path access attempt', { ip, url: req.originalUrl });
      return res.status(404).json({
        success: false,
        message: 'Not found.',
        error: { code: 'NOT_FOUND' }
      });
    }
  }
  next();
};

/**
 * MIDDLEWARE 3: Suspicious User-Agent Detector
 */
const suspiciousUADetector = (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  const ua = req.headers['user-agent'] || '';
  if (!ua) {
    // No UA at all — suspicious in production, allow in dev
    if (process.env.NODE_ENV === 'production') {
      logger.warn('[FORTRESS] Request with no User-Agent', { ip: req.ip });
      // Don't hard-block, but record
      recordAnomaly(req.ip, 'no_ua', req.id);
    }
    return next();
  }
  for (const pattern of SUSPICIOUS_UA_PATTERNS) {
    if (pattern.test(ua)) {
      const ip = req.ip;
      recordAnomaly(ip, 'suspicious_ua', req.id);
      logger.warn('[FORTRESS] Suspicious User-Agent blocked', { ip, ua, url: req.originalUrl });
      return res.status(403).json({
        success: false,
        message: 'Access denied.',
        error: { code: 'ACCESS_DENIED' }
      });
    }
  }
  next();
};

/**
 * MIDDLEWARE 4: Deep Injection Scanner
 * Scans body, query, params for all injection types after decoding.
 */
const deepInjectionScanner = (req, res, next) => {
  if (req.method === 'OPTIONS') return next();

  // Performance Optimization: "Fast-Track" for lightweight GET requests
  // Skip scanning for common safe endpoints that take no critical input
  const FAST_TRACK_ROUTES = ['/api/system/maintenance', '/api/quotes', '/api/announcements/active'];
  if (req.method === 'GET' && FAST_TRACK_ROUTES.includes(req.originalUrl)) {
    return next();
  }

  const ip = req.ip;

  // Scan query params
  const queryResult = deepScan(req.query, 'query');
  if (queryResult.threat) {
    recordAnomaly(ip, queryResult.type, req.id);
    logger.warn('[FORTRESS] Injection detected in query', {
      ip, type: queryResult.type, field: queryResult.matched,
      url: req.originalUrl, requestId: req.id
    });
    return res.status(400).json({
      success: false,
      message: 'Invalid request.',
      error: { code: 'INVALID_REQUEST' }
    });
  }

  // Scan body
  if (req.body && Object.keys(req.body).length > 0) {
    const bodyResult = deepScan(req.body, 'body');
    if (bodyResult.threat) {
      recordAnomaly(ip, bodyResult.type, req.id);
      logger.warn('[FORTRESS] Injection detected in body', {
        ip, type: bodyResult.type, field: bodyResult.matched,
        url: req.originalUrl, requestId: req.id
      });
      return res.status(400).json({
        success: false,
        message: 'Invalid request.',
        error: { code: 'INVALID_REQUEST' }
      });
    }
  }

  // Scan path params
  const paramsResult = deepScan(req.params, 'params');
  if (paramsResult.threat) {
    recordAnomaly(ip, paramsResult.type, req.id);
    logger.warn('[FORTRESS] Injection detected in params', {
      ip, type: paramsResult.type, field: paramsResult.matched,
      url: req.originalUrl, requestId: req.id
    });
    return res.status(400).json({
      success: false,
      message: 'Invalid request.',
      error: { code: 'INVALID_REQUEST' }
    });
  }

  next();
};

/**
 * MIDDLEWARE 5: Payload Structure Validator
 * Prevents deeply nested / excessively large payloads (JSON bombs).
 */
const payloadStructureValidator = (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  if (!req.body || typeof req.body !== 'object') return next();

  const check = validatePayloadStructure(req.body);
  if (!check.valid) {
    const ip = req.ip;
    recordAnomaly(ip, 'malformed_payload', req.id);
    logger.warn('[FORTRESS] Malformed payload structure', {
      ip, reason: check.reason, url: req.originalUrl
    });
    return res.status(400).json({
      success: false,
      message: 'Invalid request structure.',
      error: { code: 'INVALID_PAYLOAD' }
    });
  }
  next();
};

/**
 * MIDDLEWARE 6: Header Injection Guard
 * Prevents HTTP Response Splitting via injected newlines in headers.
 */
const headerInjectionGuard = (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  const dangerousHeaders = ['x-forwarded-host', 'x-original-url', 'x-rewrite-url'];
  for (const header of dangerousHeaders) {
    const val = req.headers[header];
    if (val && /[\r\n]/.test(val)) {
      const ip = req.ip;
      recordAnomaly(ip, 'header_injection', req.id);
      logger.warn('[FORTRESS] Header injection attempt', { ip, header, url: req.originalUrl });
      return res.status(400).json({
        success: false,
        message: 'Invalid request.',
        error: { code: 'INVALID_REQUEST' }
      });
    }
  }
  next();
};

/**
 * MIDDLEWARE 7: Request Fingerprinter
 * Attaches a fingerprint to every request for traceability.
 */
const requestFingerprinter = (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  req.fingerprint = fingerprintRequest(req);
  res.setHeader('X-Request-Fingerprint', req.fingerprint);
  next();
};

/**
 * MIDDLEWARE 8: Content-Type Enforcer
 * POST/PUT/PATCH must declare content-type to prevent CSRF-via-form.
 */
const contentTypeEnforcer = (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const ct = req.headers['content-type'] || '';
    if (!ct && req.originalUrl.startsWith('/api/')) {
      logger.warn('[FORTRESS] Missing Content-Type on mutation request', {
        ip: req.ip, url: req.originalUrl
      });
      return res.status(415).json({
        success: false,
        message: 'Content-Type header required.',
        error: { code: 'MISSING_CONTENT_TYPE' }
      });
    }
  }
  next();
};

/**
 * MIDDLEWARE 9: Prototype Pollution Freeze
 * Freezes prototype chain on incoming objects to prevent pollution.
 */
const prototypePollutionFreeze = (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  const freeze = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    const keys = Object.keys(obj);
    if (keys.includes('__proto__') || keys.includes('constructor') || keys.includes('prototype')) {
      const ip = req.ip;
      recordAnomaly(ip, 'prototype_pollution', req.id);
      logger.warn('[FORTRESS] Prototype pollution attempt blocked', { ip, url: req.originalUrl });
      return true; // Threat found
    }
    return false;
  };

  if (freeze(req.body) || freeze(req.query) || freeze(req.params)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid request.',
      error: { code: 'INVALID_REQUEST' }
    });
  }
  next();
};

/**
 * MIDDLEWARE 10: URL Overflow Guard
 * Rejects abnormally long URLs used in DoS / scanner attacks.
 */
const urlOverflowGuard = (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  const MAX_URL_LENGTH = 2048;
  if (req.originalUrl.length > MAX_URL_LENGTH) {
    recordAnomaly(req.ip, 'url_overflow', req.id);
    return res.status(414).json({
      success: false,
      message: 'Request URI too long.',
      error: { code: 'URI_TOO_LONG' }
    });
  }
  next();
};

/**
 * MIDDLEWARE 11: Security Audit Logger
 * Logs all security-relevant requests for audit trails.
 */
const securityAuditLogger = (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  // Log admin-sensitive endpoints always
  const sensitivePatterns = ['/api/admin', '/vault', '/gatekeeper', '/api/auth'];
  if (sensitivePatterns.some(p => req.originalUrl.startsWith(p))) {
    logger.info('[AUDIT]', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      fingerprint: req.fingerprint,
      ua: req.headers['user-agent'],
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }
  next();
};

/**
 * MIDDLEWARE 12: Response Security Hardener
 * Strips information-leaking headers, adds security headers not covered by helmet.
 */
const responseSecurityHardener = (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  // Remove server fingerprinting
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  res.removeHeader('Via');

  // Permissions Policy (Feature Policy)
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  );

  // Cross-Origin Policies
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

  // DNS Prefetch
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  // Download options
  res.setHeader('X-Download-Options', 'noopen');

  // Expect-CT (Certificate Transparency)
  res.setHeader('Expect-CT', 'max-age=86400, enforce');

  next();
};

// ═══════════════════════════════════════════════════════════════════
// § 7. FORTRESS STACK — ordered array of all middlewares
// ═══════════════════════════════════════════════════════════════════

const fortressStack = [
  urlOverflowGuard,          // 1. Reject oversized URLs first
  hardBlockCheck,            // 2. Reject already-blocked IPs
  blockedPathGuard,          // 3. Block attack-target paths
  requestFingerprinter,      // 4. Fingerprint all requests
  suspiciousUADetector,      // 5. Detect scanner UAs
  headerInjectionGuard,      // 6. Prevent header splitting
  contentTypeEnforcer,       // 7. Enforce Content-Type on mutations
  prototypePollutionFreeze,  // 8. Block prototype pollution
  payloadStructureValidator, // 9. Validate payload depth/size
  deepInjectionScanner,      // 10. Deep injection scan (all types)
  responseSecurityHardener,  // 11. Harden response headers
  securityAuditLogger,       // 12. Audit log sensitive routes
];

module.exports = {
  fortressStack,
  // Export individually for selective use
  hardBlockCheck,
  blockedPathGuard,
  suspiciousUADetector,
  deepInjectionScanner,
  payloadStructureValidator,
  headerInjectionGuard,
  requestFingerprinter,
  contentTypeEnforcer,
  prototypePollutionFreeze,
  urlOverflowGuard,
  securityAuditLogger,
  responseSecurityHardener,
  // Expose for testing
  deepScan,
  isHardBlocked,
};
