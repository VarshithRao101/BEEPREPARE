# BEEPREPARE Performance Audit Report (LOAD_TIME_AUDIT.md)

## Executive Summary
The BEEPREPARE platform currently suffers from high "Perceived Latency" primarily due to **Sequential API Chaining** and **Serverless Cold Starts**. While the database indexing is exceptionally healthy, the architectural pattern of "Wait-then-Fetch" across the frontend and sequential query execution in the backend results in load times exceeding 5 seconds on cold boots.

---

## SECTION 1 — API CALL MAPPING (FRONTEND)

### Page: `index.html` (Landing/Login)
| # | Endpoint | Method | When Called | Waits For Previous? |
|---|----------|--------|-------------|---------------------|
| 1 | `/health` | GET | on page load | NO |
| 2 | `/api/system/maintenance` | GET | on page load | NO |
| 3 | `/api/announcements/active` | GET | on page load | NO |
| 4 | `Firebase Auth State` | - | on page load | NO |
| 5 | `/api/auth/verify-session` | POST | after Auth State | **YES** (Waits for Firebase) |

### Page: `student-home.html` (Student Dashboard)
| # | Endpoint | Method | When Called | Waits For Previous? |
|---|----------|--------|-------------|---------------------|
| 1 | `/health` | GET | on page load | NO |
| 2 | `/api/system/maintenance` | GET | on page load | NO |
| 3 | `/api/announcements/active` | GET | on page load | NO |
| 4 | `/api/auth/verify-session` | POST | `guardStudent()` | **YES** (Waits for Token) |
| 5 | `/api/student/dashboard` | GET | `loadDashboard()` | **YES** (Waits for Guard) |

### Page: `teacher-home.html` (Teacher Dashboard)
| # | Endpoint | Method | When Called | Waits For Previous? |
|---|----------|--------|-------------|---------------------|
| 1 | `/health` | GET | on page load | NO |
| 2 | `/api/system/maintenance` | GET | on page load | NO |
| 3 | `/api/announcements/active` | GET | on page load | NO |
| 4 | `/api/auth/verify-session` | POST | `guardTeacher()` | **YES** (Waits for Token) |
| 5 | `/api/teacher/dashboard` | GET | `loadDashboard()` | **YES** (Waits for Guard) |

### Page: `student-bank.html` (Bank Inventory)
| # | Endpoint | Method | When Called | Waits For Previous? |
|---|----------|--------|-------------|---------------------|
| 1 | `/api/auth/verify-session` | POST | `guardStudent()` | **YES** (Waits for Token) |
| 2 | `/api/student/banks` | GET | `loadMyBanks()` | **YES** (Waits for Guard) |
| 3 | `/api/student/banks/{id}/chapters`| GET | `loadChapters()` | **YES** (User Interaction) |
| 4 | `/api/student/notes?bankId=...` | GET | `loadChapters()` | **YES** (Waits for Chapters API) |

---

## SECTION 2 — BACKEND ROUTE & DB QUERY AUDIT

### Route: `GET /api/student/dashboard`
| # | DB Operation | Model | Parallel? | Lean/Select? |
|---|--------------|-------|-----------|--------------|
| 1 | `findOne` | Streak | **NO** (syncStreak) | NO / NO |
| 2 | `find` | TestSession | YES | YES / YES |
| 3 | `find` | Doubt | YES | YES / NO |
| 4 | `find` | ActivityLog | YES | YES / NO |
| 5 | `find` | Bank | **NO** (after Streak) | YES / YES |
| 6 | `countDocuments` | Quote | **NO** (after Banks) | - |
| 7 | `findOne` | Quote | **NO** (after Count) | YES / NO |

### Route: `GET /api/teacher/dashboard`
| # | DB Operation | Model | Parallel? | Lean/Select? |
|---|--------------|-------|-----------|--------------|
| 1 | `find` | Bank | YES | YES / YES |
| 2 | `find` | ActivityLog | YES | YES / YES |
| 3 | `countDocuments` | Doubt | YES | - |
| 4 | `countDocuments` | AccessRequest | YES | - |
| 5 | `updateOne` | User | **NO** (after results) | - |

### Route: `GET /api/teacher/profile`
| # | DB Operation | Model | Parallel? | Lean/Select? |
|---|--------------|-------|-----------|--------------|
| 1 | `countDocuments` | Note | **NO** | - |
| 2 | `findOne` | User | **NO** (in loop) | YES / YES |
| 3 | `find` | Bank | YES | YES / NO |
| 4 | `countDocuments` | Question | YES (timeout race)| - |
| 5 | `updateOne` | User | **NO** (sync) | - |

---

## SECTION 3 — MODEL INDEX VALIDATION

| Model | Status | Critical Indices Found | Missing Indices? |
|-------|--------|-------------------------|------------------|
| **Bank** | ✅ HEALTHY | `teacherId`, `bankCode`, `approvedStudents` | None |
| **Question** | ✅ HEALTHY | `bankId`, `chapterId`, `questionType`, `metaTags` | None |
| **User** | ✅ HEALTHY | `googleUid`, `email`, `role`, `isActivated` | None |
| **ActivityLog**| ✅ HEALTHY | `userId`, `createdAt` | None |
| **Doubt** | ✅ HEALTHY | `teacherId`, `unreadByTeacher`, `studentId` | None |
| **AccessReq** | ✅ HEALTHY | `bankId`, `studentId`, `teacherId`, `status` | None |

---

## SECTION 4 — INFRASTRUCTURE & COLD START CONFIG

### Database Connection (`db.js`)
- **Global Cache:** YES (`global._mongooseCache`)
- **BufferCommands Disabled:** YES (Prevents hanging on cold start)
- **Pool Size:** 10 (Sufficient for serverless)
- **Dual Clusters:** YES (Separates high-volume Questions from App Data)

### Vercel Serverless Optimization (`vercel.json`)
- **Compression:** ENABLED (via `compression` middleware in `server.js`)
- **Warmup Cron:** MISSING (Cron runs daily, not every 5 mins. Functions will go cold.)
- **Static Asset Headers:** ENABLED (`Cache-Control: public, max-age=31536000`)

---

## SECTION 5 — RANKING: SLOWEST PAGES

*Formula: Latency + (N_Sequential_APIs * ColdStart) + (Total_DB_Time)*
*Assumption: Ping=200ms, ColdStart=1500ms, DB_Op=150ms*

| Rank | Page | Est. Load Time | Primary Root Cause |
|---|---|---|---|
| 1 | **Student Bank** | **6.1s** | Sequential Chaining: Guard -> Chapters -> Notes. |
| 2 | **Student Home** | **5.4s** | 3 Sequential APIs + 5 Sequential DB queries. |
| 3 | **Teacher Home** | **4.8s** | 3 Sequential APIs + Cold Start. |
| 4 | **Teacher Profile**| **4.6s** | Cluster 1 (Questions) count timeout/contention. |

---

## FINAL ROOT CAUSE SUMMARY

1.  **Sequential API Execution (High Impact):** The `guard` functions in `bee-core.js` block the main data fetch. Pages wait for `/auth/verify-session` to finish before even *starting* the dashboard request.
2.  **Serverless Cold Starts (Medium Impact):** No active warmup strategy is implemented. The first user of the hour experiences a 1.5s - 3s delay while the Vercel function boots.
3.  **Backend Sequentialism (Low-Medium Impact):** The Student Dashboard API performs 5 database operations in a waterfall (one after another) instead of using `Promise.all`.
4.  **Redundant Auth Verification (Low Impact):** Every page load triggers `/auth/verify-session`, even if the session was verified 5 seconds ago on the previous page.
5.  **Missing Global Buffer (Config):** While `bufferCommands` is false, the lack of a `/health` warmup route being hit frequently means every first request carries the weight of the DB handshake.

**Audit Complete.** No fixes implemented as per instructions.
