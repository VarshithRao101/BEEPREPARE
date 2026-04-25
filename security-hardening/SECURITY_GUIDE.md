# 🔒 BEEPREPARE — COMPLETE SECURITY HARDENING GUIDE
## Post-Audit Implementation Checklist

---

## ⚡ PHASE 0 — IMMEDIATE (Do RIGHT NOW, Before Anything Else)

These must be done before any code changes. Your secrets were exposed.

- [ ] **MongoDB** → Atlas Dashboard → Database Access → Rotate password for BOTH users
- [ ] **Firebase** → Cloud Console → IAM → Service Accounts → Delete old key → Add new key
- [ ] **Groq** → console.groq.com → API Keys → Revoke old key → Generate new
- [ ] **Gemini** → aistudio.google.com → API Keys → Delete → Regenerate
- [ ] **Cloudinary** → Console → Settings → Security → Rotate API Secret
- [ ] **Resend** → resend.com → API Keys → Revoke → Create new
- [ ] **Admin JWT Secret** → Generate new 64-char hex secret
- [ ] **ALL Action Codes** → Replace every `BEE...` code with new random 20+ char codes
- [ ] **Admin Password** → Change all admin passwords immediately
- [ ] **Delete or revoke** the shared `.docx` file from all locations
- [ ] **Check MongoDB Atlas** → Activity Feed → Verify no unauthorized access during exposure window
- [ ] **Check Firebase** → Cloud Console → Audit Logs → Review access during exposure window

---

## 📁 FILES IN THIS SECURITY PACKAGE

```
security-hardening/
├── middleware/
│   ├── fortress.js          ← Master injection/anomaly guard (12 middleware layers)
│   ├── csrf.js              ← CSRF token generation & validation
│   ├── paymentSecurity.js   ← UTR dedup, idempotency, fraud fingerprinting
│   └── adminFortress.js     ← Admin brute-force, session binding, action codes
├── utils/
│   ├── encryption.js        ← AES-256-GCM field-level encryption
│   └── logger.js            ← Signed, tamper-evident structured logger
├── config/
│   └── validateEnv.js       ← Startup env validation (blocks weak/missing secrets)
├── firestore.rules          ← Hardened Firestore security rules
├── storage.rules            ← Hardened Firebase Storage security rules
├── .env.secure.template     ← Full .env template with all new variables
└── INTEGRATION_GUIDE.js     ← Exact server.js patch instructions
```

---

## 🔧 PHASE 1 — Install New Dependencies

```bash
cd beeprepare-backend
npm install uuid
# All other deps (crypto, fs) are Node.js built-ins
```

---

## 🔧 PHASE 2 — Drop Files Into Your Project

```bash
# Copy middleware
cp security-hardening/middleware/fortress.js        beeprepare-backend/middleware/fortress.js
cp security-hardening/middleware/csrf.js            beeprepare-backend/middleware/csrf.js
cp security-hardening/middleware/paymentSecurity.js beeprepare-backend/middleware/paymentSecurity.js
cp security-hardening/middleware/adminFortress.js   beeprepare-backend/middleware/adminFortress.js

# Copy utilities
cp security-hardening/utils/encryption.js  beeprepare-backend/utils/encryption.js
cp security-hardening/utils/logger.js      beeprepare-backend/utils/logger.js

# Copy config
cp security-hardening/config/validateEnv.js beeprepare-backend/config/validateEnv.js

# Copy Firebase rules
cp security-hardening/firestore.rules beeprepare-backend/firestore.rules
cp security-hardening/storage.rules   beeprepare-backend/storage.rules
```

---

## 🔧 PHASE 3 — Update server.js

Open `beeprepare-backend/server.js` and make these changes:

### 3a. Add at the very top (after existing requires):
```js
require('./config/validateEnv')();                    // ← FIRST LINE after requires
const { fortressStack } = require('./middleware/fortress');
const { csrfTokenEndpoint } = require('./middleware/csrf');
```

### 3b. Add fortress BEFORE all other middleware:
```js
// === FORTRESS (must be before everything) ===
app.use(fortressStack);
```

### 3c. Add CSRF endpoint:
```js
app.get('/api/csrf-token', requireAuth, csrfTokenEndpoint);
```

### 3d. Replace your logger usage:
```js
// Find anywhere you use console.log/warn/error for security events
// Replace with:
const logger = require('./utils/logger');
app.use(logger.requestLogger);
```

---

## 🔧 PHASE 4 — Update routes/payment.js

Add payment security stack to your submit route:

```js
const { paymentSecurityStack } = require('../middleware/paymentSecurity');

router.post('/submit',
  paymentSecurityStack,      // ← ADD THIS
  validatePaymentSubmit,
  ctrl.submitPayment
);

// SECURE these routes — they were public before:
router.get('/status/:utrNumber', requireAuth, ctrl.checkPaymentStatus);
router.post('/resend/:utrNumber', requireAuth, ctrl.resendApprovalEmail);
```

---

## 🔧 PHASE 5 — Update routes/admin.js

```js
const {
  adminBruteForceGuard,
  adminSessionBindingCheck,
  requireActionCode,
  bindSession
} = require('../middleware/adminFortress');

// Add to login route:
router.post('/login', adminBruteForceGuard, validateAdminLogin, async (req, res) => {
  // ... existing login logic ...
  // On failure: req.recordFailedLogin();
  // On success: req.recordSuccessfulLogin(); bindSession(admin.id, req.ip, req.headers['user-agent'], req.fingerprint);
});

// Add session binding to ALL protected routes:
router.use(requireAdmin, adminSessionBindingCheck);

// Add action codes to destructive routes:
router.post('/block-user',      requireAdmin, adminSessionBindingCheck, requireActionCode('BLOCK_USER'),      ctrl.blockUser);
router.post('/delete-user',     requireAdmin, adminSessionBindingCheck, requireActionCode('DELETE_USER'),     ctrl.deleteUser);
router.post('/approve-payment', requireAdmin, adminSessionBindingCheck, requireActionCode('APPROVE_PAYMENT'), ctrl.approvePayment);
router.post('/reject-payment',  requireAdmin, adminSessionBindingCheck, requireActionCode('REJECT_PAYMENT'),  ctrl.rejectPayment);
router.post('/generate-keys',   requireAdmin, adminSessionBindingCheck, requireActionCode('GENERATE_KEYS'),   ctrl.generateKeys);
router.post('/maintenance',     requireAdmin, adminSessionBindingCheck, requireActionCode('MAINTENANCE_ON'),  ctrl.setMaintenance);
```

---

## 🔧 PHASE 6 — Update .env

Generate new secrets using Node.js:
```bash
# Generate 64-char hex string (run for each secret)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate bcrypt hash for admin password
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('YourNewPassword', 12).then(console.log)"
```

Add to `.env`:
```
ENCRYPTION_SECRET=<64-char-hex>
LOOKUP_HMAC_SECRET=<64-char-hex>
```

---

## 🔧 PHASE 7 — Deploy Firebase Rules

```bash
cd beeprepare-backend
firebase deploy --only firestore:rules
firebase deploy --only storage
```

---

## 🔧 PHASE 8 — Verify .gitignore

Make sure `beeprepare-backend/.gitignore` contains:
```
.env
.env.*
!.env.example
*.pem
*.key
serviceAccountKey.json
logs/
```

Then verify no secrets are tracked:
```bash
git ls-files | grep -E "\.env|\.key|\.pem|serviceAccount"
# If anything shows up: git rm --cached <filename>
```

---

## 🔧 PHASE 9 — MongoDB Atlas Hardening

In MongoDB Atlas dashboard:

1. **Network Access** → Add your server's IP → Remove `0.0.0.0/0` (open to world)
2. **Database Access** → For each user:
   - Minimum required privileges only
   - Enable IP allowlist on user level
3. **Advanced** → Enable Audit Logging
4. **Alerts** → Set up alerts for:
   - Failed authentication attempts
   - Unusual data access patterns
   - Connection spike alerts

---

## 🔧 PHASE 10 — Firebase Hardening

In Firebase Console:

1. **Authentication** → Sign-in methods:
   - Enable email verification requirement
   - Enable account deletion protection
2. **App Check** → Enable for:
   - Firestore
   - Storage
   - Cloud Functions (if any)
3. **Security Rules** → Deploy the new `firestore.rules` and `storage.rules`
4. **IAM** → Service Accounts:
   - Delete old compromised key
   - Create new key with minimum permissions

---

## 🔧 PHASE 11 — Admin Panel Hardening (matrix-core-v1419)

Your admin panel HTML files need these changes:

### Add CSRF token to all state-changing requests:
```js
// In matrix-core.js, add this helper:
async function getCSRFToken() {
  const res = await fetch('/api/admin-csrf-token', { credentials: 'include' });
  const data = await res.json();
  return data.data.csrfToken;
}

// Then on every POST/PUT/DELETE:
const csrfToken = await getCSRFToken();
const res = await fetch('/api/admin/block-user', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`,
    'X-CSRF-Token': csrfToken,       // ← ADD THIS
  },
  body: JSON.stringify({ userId, actionCode })
});
```

---

## 📊 SECURITY COVERAGE SUMMARY

| Threat | Protection | File |
|--------|-----------|------|
| SQL/NoSQL Injection | Deep pattern scanner + decode tricks | fortress.js |
| XSS | Pattern detection + CSP headers | fortress.js |
| Command Injection | Shell metachar detection | fortress.js |
| SSTI | Template pattern detection | fortress.js |
| XXE | XML entity pattern detection | fortress.js |
| Prototype Pollution | Key inspection + freeze | fortress.js |
| Path Traversal | Pattern detection in all inputs | fortress.js |
| Header Injection | CR/LF detection | fortress.js |
| JSON Bombs | Depth + key count limits | fortress.js |
| Scanner Bots | UA fingerprinting | fortress.js |
| Brute Force | IP lockout + anomaly tracking | fortress.js + adminFortress.js |
| Session Hijacking | Device fingerprint binding | adminFortress.js |
| CSRF | Double-submit HMAC token | csrf.js |
| Payment Replay | UTR dedup + idempotency | paymentSecurity.js |
| Price Tampering | Server-side price validation | paymentSecurity.js |
| Payment Fraud | Device fingerprint + rate limit | paymentSecurity.js |
| Data at Rest | AES-256-GCM field encryption | encryption.js |
| Secrets Exposure | Startup validator + templates | validateEnv.js |
| Log Tampering | HMAC-signed log entries | logger.js |
| Firestore Access | Deny-by-default rules | firestore.rules |
| Storage Access | Strict ownership + type rules | storage.rules |
| Env Weak Secrets | Startup validation + blocking | validateEnv.js |
| Compromised Secrets | Known-value blocklist | validateEnv.js |

---

## 🔄 ONGOING SECURITY PRACTICES

1. **Rotate all secrets every 90 days** (set a calendar reminder)
2. **Review security logs weekly** (`logs/security-*.log`)
3. **Monitor MongoDB Atlas** → Activity Feed monthly
4. **Keep dependencies updated**: `npm audit` weekly, `npm update` monthly
5. **Never share .env contents** — use a password manager or secrets vault
6. **Test security** before each major release: run OWASP ZAP against staging
7. **Enable 2FA** on all: MongoDB Atlas, Firebase, Cloudinary, GitHub, Resend, Groq

---

*Generated by BEEPREPARE Security Audit — Rotate all compromised credentials immediately.*
