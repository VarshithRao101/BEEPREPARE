# CRITICAL_AUDIT.md

## Check 1 — First thing on load
- **Function Name**: Global execution of `bee-core.js` and subsequent auto-init tasks (`BP.initLoader`, `BP.initMaintenanceCheck`, `BP.initAnnouncementBanner`).
- **Steps in order**:
  1. `fetch('/health')`: Silent warmup fires immediately (Line 6).
  2. **Vercel Analytics**: Async import of analytics (Line 11-12).
  3. **Firebase Init**: `initializeApp(firebaseConfig)` (Line 32).
  4. `BP.initLoader()`: Injects loader CSS and DOM elements (Line 905).
  5. `BP.initMaintenanceCheck()`: Calls `/system/maintenance` (Line 906).
  6. `BP.initAnnouncementBanner()`: Calls `/announcements/active` (Line 907).
  7. **Page Initialization**: Individual pages call `initPage()`, which calls `BP.showLoader()` (Line 188).
- **Await before visibility**: Yes. `initPage` is `async` and awaited by page logic. It waits for `getFreshToken`, `verifySession`, and `dataFetchFn` (Line 197-207).
- **Blocking Loops**: 
  - `apiCall` contains a `while` loop for client-side rate limiting (Line 258).
  - `BP.initStreakFlame` uses `requestAnimationFrame` for animation.
- **Infinite Loading Timeout**: `getFreshToken` has a **5s hard limit** for Firebase auth state (Line 70). However, if the network is down and `apiCall` fails, `initPage` has no final `hideLoader` call, leading to infinite loading.

## Check 2 — Loading screen logic
| File | Element | What shows it | What HIDES it | Can it get stuck? |
|------|---------|---------------|---------------|-------------------|
| `bee-core.js` | `#bee-loader-overlay` | `BP.showLoader()` | `BP.hideLoader()` | **YES (STUCK RISK)** |
| `teacher-home.html` | `.skeleton` | Inline HTML | `loadDashboard` (replacing innerHTML) | No (replaced by data) |
| `student-home.html` | `.skeleton` | Inline HTML | `loadDashboard` (if success) | **YES (STUCK RISK)** |
| `student-bank.html` | `.skeleton` | Inline HTML | `renderBankCards` (if success) | **YES (STUCK RISK)** |

> [!CAUTION]
> **STUCK RISK**: `initPage` in `bee-core.js` increments `_loaderCount` at the start but **never decrements it**. Since `apiCall` is balanced (+1, -1), the count remains at 1, keeping the loader visible forever.

## Check 3 — Firebase Auth
- **onAuthStateChanged**: Called in `getFreshToken` (Line 65) and `BP.getAuthUser` (Line 493).
- **5s Response**: `getFreshToken` resolves after 5s regardless of Firebase response (Line 70).
- **Timeout Fallback**: 5s in `getFreshToken`, 800ms in `getAuthUser`.
- **Not Logged In**: `apiCall` (via `verifySession`) will detect 401/Unauthorized and redirect to `index.html` (Line 321). 
- **Wait for Firebase**: Yes, `initPage` awaits `getFreshToken` which waits for Firebase.

## Check 4 — Mobile issues
| Check | Answer |
|-------|--------|
| Is there a <meta name="viewport"> tag? | **YES** (Present in all audited HTML files) |
| Does any script use window.innerWidth/screen.width for logic? | **YES** (`study-circles.html` uses `innerWidth < 850`) |
| Are there any desktop-only API calls that fail on mobile? | **NO** (Standard `fetch` used) |
| Does Firebase popup work on mobile browsers? | **NO** (Often blocked by default) |
| Is signInWithPopup used? (FAILS on mobile) | **YES** (Used in `index.html`) |
| Is signInWithRedirect used? (works on mobile) | **NO** |

## Check 5 — Session cache
- **_sessionCache**: Exists (Line 122).
- **SESSION_CACHE_TTL**: `4 * 60 * 1000` (4 minutes).
- **clearSessionCache()**: Called on logout and 401 failure in guards.
- **Invalid Value Handling**: Set to `null` in `verifySession` catch block (Line 152).
- **Failure Behavior**: If `verifySession` fails, `apiCall` redirects to login. However, if the redirect fails or takes time, the page stays on the loader due to the `initPage` count bug.

## Check 6 — Data loading functions
| Page | Load Function | Has try/catch? | catch block does what? | Shows error if fails? |
|------|--------------|----------------|------------------------|----------------------|
| `teacher-home.html` | `loadDashboard` | No (`.catch`) | Returns `null` | **YES** ("SIGNAL DROPPED") |
| `student-home.html` | `loadDashboard` | No (`.catch`) | Returns `null` | **NO** (Skeletons stay) |
| `student-bank.html` | `loadMyBanks` | **YES** | `console.error` | **NO** (Skeletons stay) |
| `student-bank.html` | `loadBankData` | No (`Promise.allSettled`) | N/A | **NO** (Silent failure) |

## Check 7 — vercel.json
```json
{
  "version": 2,
  "name": "beeprepare",
  "crons": [{ "path": "/health", "schedule": "0 0 * * *" }],
  "builds": [
    { "src": "beeprepare-backend/server.js", "use": "@vercel/node", "config": { "includeFiles": ["assets/**", "matrix-core-v1419/**", "beeprepare-backend/**"] } },
    { "src": "index.html", "use": "@vercel/static" },
    { "src": "activation.html", "use": "@vercel/static" },
    { "src": "assets/**", "use": "@vercel/static" },
    { "src": "beginners/**", "use": "@vercel/static" }
  ],
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/beeprepare-backend/server.js" },
    { "source": "/gatekeeper", "destination": "/beeprepare-backend/server.js" },
    { "source": "/gate/(.*)", "destination": "/beeprepare-backend/server.js" },
    { "source": "/vault", "destination": "/beeprepare-backend/server.js" },
    { "source": "/health", "destination": "/beeprepare-backend/server.js" },
    { "source": "/(index.html)?", "destination": "/index.html" },
    { "source": "/beginners/(.*)", "destination": "/beginners/$1" }
  ],
  "headers": [
    { "source": "/assets/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] }
  ]
}
```
- **Frontend Serving**: HTML files are correctly mapped to `@vercel/static`.
- **Catch-all Route**: Missing. There is no fallback for client-side routing or 404s.
- **API Separation**: Clearly separated via `/api/` rewrites to the Node backend.

## Check 8 — Dependencies (`beeprepare-backend/package.json`)
- **Node version**: Not specified in `engines`.
- **Compression**: **YES** (Line 15).
- **Dotenv**: **YES** (Line 19).
- **Main/Start**: `server.js` / `node server.js`.
- **Bloat Risks**: 
  - `firebase-admin` (Large)
  - `mongoose` (Large)
  - `jsdom` (High memory usage in serverless)

---

## VERDICT

### 🚨 STUCK RISKS FOUND
1.  **`initPage` Loader Imbalance**: In `bee-core.js`, `initPage` calls `BP.showLoader()` (+1) but never calls `BP.hideLoader()`. Since `apiCall` is balanced, the `_loaderCount` stays at 1 indefinitely. **This causes the loading screen to never disappear.**
2.  **Silent Data Failures**: `student-home.html` and `student-bank.html` do not handle API failures in the UI. If the fetch fails, the skeletons remain visible forever.
3.  **Firebase Redirect Loop**: In `index.html`, if the local token is present but Firebase says "No User", it attempts to clear the token, but the `onAuthStateChanged` listener might still be active, causing potential race conditions.

### 📱 LIKELY REASON FOR MOBILE STUCK
**`signInWithPopup` usage in `index.html`.** Most mobile browsers (especially on iOS) block popups by default. Since there is no fallback to `signInWithRedirect`, the login flow simply halts or errors out silently on mobile.

### 🖥️ LIKELY REASON FOR DATA FAILURE (DESKTOP)
**Loader Count Bug.** The data likely *is* loading in the background, but because the `_loaderCount` never reaches 0, the yellow loading overlay stays on top of the UI, making it appear as if the app is stuck.
