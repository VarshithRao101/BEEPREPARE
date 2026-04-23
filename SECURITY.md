# BEEPREPARE: Enterprise-Grade Security Architecture Report

## 🛡️ Executive Summary
The BEEPREPARE platform has been upgraded with a **Multi-Layered Security Framework** designed to protect intellectual property, prevent revenue leakage, and ensure data integrity. This architecture follows the principle of **Defense in Depth**, ensuring that the failure of a single security control does not compromise the entire system.

---

## 🏛️ Layered Defense Strategy

### Layer 1: Input & Edge Security
*   **Recursive Sanitization**: All incoming request bodies are recursively scrubbed to block MongoDB operator injection (e.g., `{"$gt": ""}`) and XSS patterns.
*   **Payload Protection**: Enforced strict request body size limits (default 50kb for JSON) to prevent ReDoS and Buffer Overflow attacks.
*   **Parameter Pollution**: Integrated `hpp` to block HTTP Parameter Pollution (e.g., duplicate query params).

### Layer 2: Authentication Hardening
*   **Token Caching**: Implemented an in-memory TTL cache for Firebase ID tokens, reducing external API overhead while ensuring millisecond-level verification.
*   **Blacklist Enforcement**: A global email-based blacklist is checked on every request. Blocked accounts are immediately revoked from the session.
*   **Status Enforcement**: The system strictly enforces the `isActivated` and `role` state machine. Requests from users with incomplete profiles are trapped in the role-select gateway.

### Layer 3: API & Traffic Control
*   **Granular Rate Limiting**:
    *   **Global**: Prevents general crawling and brute-force.
    *   **Auth**: Specific 10-req/15m limit for login/role set.
    *   **AI Engine**: Throttles Gemini API usage to prevent account depletion.
    *   **Uploads**: Strict limits on binary data submission.
*   **Request Tracking**: Every request is assigned a `X-Request-ID` (UUID v4) for end-to-end trace auditing.

### Layer 4: Data Transmission & Privacy
*   **Response Masking**: A custom middleware interceptor automatically strips internal fields (`otpHash`, `__v`, `licenseKey`, `API_KEYS`) from all outgoing JSON responses.
*   **Helmet Security**: Full CSP, HSTS, and Frame-Protection headers implemented via `helmet`.
*   **Strict Projections**: Database queries are hard-coded to exclude sensitive fields (e.g., `User.findById(id).select('-otpHash')`).

### Layer 5: Administrative Integrity (Rolling Gateway)
*   **The Rolling Gate**: The Admin dashboard is protected by a dual-token rolling gateway.
    *   **GATE_KEY**: A static environment secret required to view the login portal.
    *   **ENTRY_SECRET**: A dynamic session-based secret required for authentication.
*   **Action Code Verification**: Critical actions (deleting users, generating keys, wiping data) require independent "Action Codes" verified serverside before execution.

### Layer 6: Data Integrity & DB Security
*   **Ownership Enforcement**: Every write operation in the Teacher/Student bank engines includes a mandatory ownership check (`bank.teacherId === req.user.googleUid`).
*   **Dual-Cluster Isolation**: Academic data (Questions) is isolated on a separate MongoDB cluster from User state, preventing lateral movement in case of a cluster-level compromise.
*   **Audit Trail**: All sensitive events are logged to `ActivityLog` with the originating IP address and metadata.

---

## 🧪 Vulnerability Mitigation Map (OWASP)

| OWASP Category | BEEPREPARE Mitigation |
| :--- | :--- |
| **Broken Access Control** | Ownership checks on every controller; Role-based route protection. |
| **Cryptographic Failures** | Hashed OTPs (Bcrypt); HTTPS enforcement; No secrets in logs. |
| **Injection** | `mongo-sanitize`; `dompurify`; Parameter escaping in search. |
| **Insecure Design** | Explicit state-machine requirements for account progression. |
| **Security Misconfig** | Mandatory environment variable validation at startup. |
| **Vulnerable & Outdated** | Automated security header management via `helmet`. |
| **Logging & Monitoring** | Request Tracking + Persistent Activity Audit Log. |

---

## 🔧 Maintenance & Best Practices
1.  **Environment Secrets**: Never share the `.env` file. The `validateEnv.js` utility will prevent the server from starting if any critical secret is missing.
2.  **Controller Audits**: When adding new routes, always use the `validateInput` and `requireAuth` middleware chain.
3.  **Audit Logs**: Regularly review the `ActivityLog` collection for unauthorized administrative attempts or repeated OTP failures.

---
> [!IMPORTANT]
> This security architecture was deployed on **April 20, 2026**. All future feature developments should adhere to the established middleware protocols to maintain the system's integrity.
