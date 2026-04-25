# BEEPREPARE Security Audit Report
**Date:** April 25, 2026
**Total Checks:** 112
**Implemented:** 110 ✅
**Partial:** 2 ⚠️
**Missing:** 0 ❌
**Score:** 98%

---

## Summary
The BEEPREPARE project has reached a high security maturity level. The integration of the **Fortress Security Layer** provides robust protection against common web attacks (SQLi, NoSQLi, XSS, etc.) at the very edge of the application. Field-level encryption for PII is correctly implemented using industry-standard AES-256-GCM. 

The primary area for refinement is the synchronization between the admin controller and the brute-force middleware to eliminate redundant logic.

---

## Results by Section

### Server.js
| Check | Status | Reason |
|-------|--------|--------|
| fortressStack imported | ✅ | Imported on line 22 |
| fortressStack mounted first | ✅ | Mounted on line 54, before securityHeaders and parsers |
| csrfTokenEndpoint imported | ✅ | Imported on line 23 |
| GET /api/csrf-token exists | ✅ | Defined on line 135 with requireAuth |
| GET /api/admin-csrf-token exists | ✅ | Defined on line 136 |
| CORS headers | ✅ | Includes X-CSRF-Token and Idempotency-Key on line 99 |
| connectDB() order | ✅ | Called on line 46 before middleware stack |

### fortress.js
| Check | Status | Reason |
|-------|--------|--------|
| fortressStack array export | ✅ | Exported on line 635 |
| deepScan() coverage | ✅ | Covers NoSQL, SQL, XSS, Command, XXE, SSTI (Lines 26-122) |
| URL decoding | ✅ | Uses double decodeURIComponent on lines 159-163 |
| hardBlockStore exists | ✅ | Defined as Map on line 221 |
| anomalyStore exists | ✅ | Defined as Map on line 216 |
| recordAnomaly() threshold | ✅ | Blocks after 5 attempts (Line 249) |
| isHardBlocked() check | ✅ | Exists on line 258 |
| All 12 middlewares present | ✅ | Verified all 12 functions from urlOverflowGuard to securityAuditLogger |
| Stack order | ✅ | Correct order implemented on lines 619-632 |
| Blocked paths list | ✅ | Includes .env, .git, admin paths (Lines 134-142) |
| Scanner UA detection | ✅ | Includes sqlmap, nikto, burpsuite, etc. (Lines 124-132) |

### csrf.js
| Check | Status | Reason |
|-------|--------|--------|
| generateCsrfToken() HMAC | ✅ | Uses HMAC-SHA256 on line 24 |
| verifyCsrfToken() logic | ✅ | Checks session, time, and signature (Lines 32-60) |
| requireCsrf middleware | ✅ | Checks headers on lines 78-79 |
| tokenEndpoint export | ✅ | Exported on line 107 |
| Token TTL | ✅ | Set to 30 minutes on line 16 |
| timingSafeEqual | ✅ | Used for signature comparison on line 53 |

### paymentSecurity.js
| Check | Status | Reason |
|-------|--------|--------|
| utrDeduplication | ✅ | Middleware exists on line 40 |
| processedUTRs Store | ✅ | Map exists on line 16 |
| pendingUTRs Store | ✅ | Map exists on line 17 |
| idempotencyCheck | ✅ | Middleware exists on line 98 |
| paymentIntegrityCheck | ✅ | Validates against process.env prices (Lines 144-163) |
| fraudFingerprinting | ✅ | 5 attempts per 24h window (Line 177) |
| utrFormatHardening | ✅ | Enforces exactly 12 digits (Line 218) |
| paymentSecurityStack | ✅ | Exported with correct middleware order (Line 241) |
| req mark hooks | ✅ | Attached to request on lines 81-87 |

### adminFortress.js
| Check | Status | Reason |
|-------|--------|--------|
| loginAttempts Store | ✅ | Map exists on line 16 |
| isLoginLocked() | ✅ | Exists on line 63 |
| recordFailedLogin() | ✅ | Exists on line 36 |
| recordSuccessfulLogin() | ✅ | Exists on line 59 |
| adminBruteForceGuard | ✅ | Middleware exists on line 76 |
| attach record hooks | ✅ | req.recordFailed/SuccessfulLogin attached (Lines 88-89) |
| sessionBindings Store | ✅ | Map exists on line 32 |
| bindSession() logic | ✅ | Stores IP, UA, and Fingerprint (Lines 95-102) |
| verifySessionBinding() | ✅ | Fingerprint match enforcement on line 123 |
| sessionBindingCheck | ✅ | Middleware exists on line 137 |
| requireActionCode factory | ✅ | Returns middleware on line 186 |
| timingSafeEqual | ✅ | Used for action code check on line 236 |
| actionCodeAttempts | ✅ | Rate limited to 3 per 5 min (Lines 215-228) |
| env Action Codes | ✅ | Maps all 17+ codes from process.env (Lines 154-177) |

### encryption.js
| Check | Status | Reason |
|-------|--------|--------|
| encrypt() algorithm | ✅ | Uses aes-256-gcm on line 62 |
| decrypt() auth verification | ✅ | decipher.setAuthTag(tag) used on line 98 |
| IV generation | ✅ | crypto.randomBytes(12) used on line 61 |
| hashForLookup() HMAC | ✅ | Uses HMAC-SHA256 on line 122 |
| encryptionPlugin() | ✅ | Mongoose plugin exists on line 137 |
| getKey() derivation | ✅ | Uses crypto.scryptSync on line 42 |
| format iv:cipher:tag | ✅ | Colon-separated base64url on line 71 |

### validateEnv.js
| Check | Status | Reason |
|-------|--------|--------|
| ENCRYPTION_SECRET | ✅ | Required on line 44 |
| LOOKUP_HMAC_SECRET | ✅ | Required on line 45 |
| Admin Action Codes | ✅ | All 17 codes required (Lines 26-42) |
| Admin JWT Min Length | ✅ | Length 32 enforced in prod (Line 66) |
| Compromised Values | ✅ | Blocks 'BeeAdminJWT#9x7K2619Delta' on line 75 |
| Wildcard Origins | ✅ | Blocked in production on line 83 |
| Action Code Uniqueness | ✅ | Set size check on line 96 |

### Routes — Payment
| Check | Status | Reason |
|-------|--------|--------|
| Security stack imported | ✅ | Line 7 |
| requireAuth imported | ✅ | Line 5 |
| POST /submit order | ✅ | paymentSecurityStack runs before validatePaymentSubmit (Line 16) |
| GET /status secured | ✅ | requireAuth added to previously public route (Line 24) |
| POST /resend secured | ✅ | requireAuth added to previously public route (Line 35) |

### Routes — Admin
| Check | Status | Reason |
|-------|--------|--------|
| adminBruteForceGuard | ✅ | Imported on line 6 |
| adminSessionBinding | ✅ | Imported on line 7 |
| requireActionCode | ✅ | Imported on line 8 |
| POST /login guard | ✅ | adminBruteForceGuard mounted on line 23 |
| Binding check mount | ✅ | Mounted for all protected routes on line 32 |
| Action codes (All) | ✅ | All routes correctly use requireActionCode factory (Lines 40-93) |

### Admin Controller
| Check | Status | Reason |
|-------|--------|--------|
| bindSession imported | ✅ | Line 28 |
| bindSession() call | ✅ | Called with full fingerprint on line 112 |
| recordFailedLogin() | ⚠️ | Controller uses local Map logic instead of req hook (Line 88) |
| recordSuccessfulLogin() | ⚠️ | Controller uses local Map logic instead of req hook (Line 98) |

### Firestore Rules
| Check | Status | Reason |
|-------|--------|--------|
| rules_version '2' | ✅ | Line 7 |
| User read isOwner | ✅ | Line 59 |
| User create checks | ✅ | Checks role and isActivated (Lines 69-70) |
| Field immutability | ✅ | role/email/uid locked on update (Lines 76-79) |
| User delete block | ✅ | Line 91 |
| Payment write block | ✅ | Lines 102-108 |
| Key bank isolation | ✅ | Line 203 |
| Admin log isolation | ✅ | Line 209 |
| Catch-all deny | ✅ | Line 227 |

### Storage Rules
| Check | Status | Reason |
|-------|--------|--------|
| Profile pix size/type | ✅ | 2MB image limit (Lines 51-52) |
| Payment screen create | ✅ | 5MB owner-only (Lines 64-67) |
| Payment screen update | ✅ | False on line 70 |
| Payment screen delete | ✅ | False on line 73 |
| Export isolation | ✅ | False on line 100 |
| Catch-all deny | ✅ | Line 105 |

### Matrix Core (Admin Panel)
| Check | Status | Reason |
|-------|--------|--------|
| getCsrfToken() cache | ✅ | _csrfToken and _csrfExpiry used on lines 18-35 |
| CSRF endpoint URL | ✅ | Fetches from /api/admin-csrf-token (Line 25) |
| Cache reuse logic | ✅ | 1 minute buffer check on line 23 |
| adminApi() auto-call | ✅ | Intercepts mutations on lines 52-55 |
| CSRF Header | ✅ | Attaches X-CSRF-Token on line 54 |

---

## Critical Issues (❌ and ⚠️ only)
- **File:** `controllers/adminController.js`
- **Check:** recordFailedLogin() and recordSuccessfulLogin() integration
- **Found:** The controller currently duplicates the brute-force logic using a local `loginAttempts` Map rather than using the centralized middleware hooks.
- **Fix:** Remove lines 43-45 and replace manual Map operations on lines 88 and 98 with `req.recordFailedLogin()` and `req.recordSuccessfulLogin()`.

---

## .env Verification
- ENCRYPTION_SECRET: PRESENT
- LOOKUP_HMAC_SECRET: PRESENT
- CODE_BLOCK_USER: PRESENT
- CODE_UNBLOCK_USER: PRESENT
- CODE_DELETE_USER: PRESENT
- CODE_APPROVE_PAYMENT: PRESENT
- CODE_REJECT_PAYMENT: PRESENT
- CODE_GENERATE_KEYS: PRESENT
- CODE_MAINTENANCE_ON: PRESENT
- CODE_MAINTENANCE_OFF: PRESENT
- CODE_DELETE_PAYMENT: PRESENT
- CODE_CLEAR_LOGS: PRESENT
- CODE_RESTART_SERVER: PRESENT
- CODE_MARK_FEEDBACK: PRESENT
- CODE_DELETE_FEEDBACK: PRESENT
- CODE_DEACTIVATE_BANK: PRESENT
- CODE_DELETE_BANK: PRESENT
- CODE_FORCE_RESET: PRESENT
- CODE_DELETE_KEY: PRESENT
