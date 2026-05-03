# Database Management System (DBMS) Usage in BEEPREPARE

## Overview

**BEEPREPARE** is a full-stack EdTech platform built for teachers and students. The backend is a Node.js + Express.js application that uses **MongoDB** as its primary database, accessed via **Mongoose ODM (Object Document Mapper)**. The system follows a structured, schema-driven approach to data management across two separate MongoDB clusters.

---

## 1. Database Technology Stack

| Component | Technology |
|---|---|
| Database System | **MongoDB** (NoSQL Document Database) |
| ODM (Object-Document Mapper) | **Mongoose v8.10.0** |
| Backend Runtime | Node.js with Express.js |
| Cloud Database Host | MongoDB Atlas (cloud-hosted, two clusters) |
| Additional Data Layer | **Firebase Firestore** (for authentication state) |

---

## 2. Dual-Cluster Architecture (Database Separation)

One of the key architectural decisions in BEEPREPARE is the use of **two separate MongoDB clusters** — this demonstrates understanding of data isolation, scalability, and query performance optimization.

### Cluster 1 — Main Database (`MONGODB_URI`)
Stores all **user and platform operational data**:
- Users, payments, licenses, admin sessions
- Doubts, study circles, bookmarks, streaks
- Access requests, notes, test sessions
- Platform settings and announcements

### Cluster 2 — Questions Database (`MONGODB_QUESTIONS_URI`)
Stores only the **academic question bank data**:
- Questions (MCQ, Short, Long, Essay, Very Short)

**Why separate?**  
The question bank is queried at very high frequency by students during test generation. Keeping it on an isolated cluster prevents heavy read loads from impacting user authentication, payments, or admin operations running on the Main DB.

### Connection Manager — `config/db.js`

```js
const connectDB = async () => {
  // Connects to BOTH clusters simultaneously on server startup
  await mongoose.connect(process.env.MONGODB_URI, opts);       // Main DB
  cached.questionsConn = await mongoose.createConnection(
    process.env.MONGODB_QUESTIONS_URI, opts
  ).asPromise();                                               // Questions DB
};
```

Key connection settings applied:
- `serverSelectionTimeoutMS: 10000` — 10-second timeout before failing
- `socketTimeoutMS: 45000` — keeps connections stable under load
- `maxPoolSize: 10` — allows up to 10 concurrent connections per cluster
- **Connection caching** via a global singleton to avoid re-connecting on every API call (critical for serverless environments like Vercel)

---

## 3. Data Models (Schema Design)

All data models are defined using **Mongoose Schemas** — a structured way to define the shape, types, validations, and indexes for each collection. There are **21 collections** spread across the two clusters.

### 3.1 Main Database Models

---

#### `User` — Core user profiles

| Field | Type | Notes |
|---|---|---|
| `googleUid` | String (unique) | Firebase Auth ID |
| `email` | String (unique) | Login email |
| `role` | Enum: `teacher` / `student` | User type |
| `isActivated` | Boolean | Platform access flag |
| `licenseKey` | String | Linked activation key |
| `licenseExpiresAt` | Date | Subscription expiry |
| `planType` | Enum: `free` / `active` | Subscription tier |
| `activeBanks` | Array of refs | Banks a student is enrolled in |
| `isBlocked` | Boolean | Admin block status |

> The `User` collection is central — most other collections reference a `userId` or `googleUid` from here.

---

#### `Question` — Academic question bank (on Questions DB)

| Field | Type | Notes |
|---|---|---|
| `teacherId` | String | Owner/creator |
| `class` | String | Target class |
| `subject` | String | Subject area |
| `questionType` | Enum | MCQ / Short / Long / Essay / Very Short |
| `questionText` | String (max 80 chars) | The question |
| `imageUrl` | String | Cloudinary URL for diagrams |
| `marks` | Number | Mark allocation |
| `difficulty` | Enum | Easy / Medium / Hard |
| `mcqOptions` | Object `{A,B,C,D}` | For MCQ type |
| `correctOption` | Enum `A/B/C/D` | Answer key |
| `isImportant` | Boolean | Flagged by teacher |
| `tags` | Array of Strings | e.g., "Exam Focus", "Repeated" |
| `bankId` | String | Cross-DB reference to Bank |

**Compound indexes defined for performance:**
```js
questionSchema.index({ teacherId: 1, class: 1, subject: 1, questionType: 1 });
questionSchema.index({ bankId: 1, questionType: 1, isImportant: 1 });
questionSchema.index({ bankId: 1, chapterId: 1, questionType: 1, isImportant: 1 });
```
These indexes drastically speed up paper generation queries which filter by multiple dimensions simultaneously.

---

#### `Bank` — Question Bank (teacher's subject bank)

| Field | Type | Notes |
|---|---|---|
| `teacherId` | String | Owner |
| `subject` | String | Subject covered |
| `class` | String | Target class |
| `chapters` | Array of objects | Chapter list with `questionCount` |
| `bankCode` | String (unique) | 6-character join code |
| `approvedStudents` | Array of Strings | Student UIDs |
| `totalQuestions` | Number | Cached count |

A `Bank` is the container that links a teacher's subject to their chapters and questions. Students join banks using the `bankCode`.

---

#### `TestSession` — Exam/Practice sessions

| Field | Type | Notes |
|---|---|---|
| `studentId` | String | Who is taking the test |
| `bankId` | ObjectId | Which bank |
| `questions` | Array | Snapshot of selected questions |
| `blueprint` | Object | MCQ/short/long counts requested |
| `totalMarks` | Number | Calculated total |
| `status` | Enum | `in_progress` / `completed` |
| `answers` | Array | Student's submitted answers |
| `score` | Number | Final score |
| `completedAt` | Date | Submission timestamp |

> Question data is **embedded as a snapshot** inside `TestSession` instead of referencing the Questions DB — this ensures test integrity even if the original question is later edited.

---

#### `Doubt` — Student-Teacher Q&A Thread

| Field | Type | Notes |
|---|---|---|
| `studentId` | String | Poster |
| `teacherId` | String | Assigned teacher |
| `status` | Enum | `pending` / `replied` / `resolved` |
| `messages` | Array of sub-documents | Threaded conversation |
| `unreadByTeacher` | Boolean | Notification flag |
| `unreadByStudent` | Boolean | Notification flag |

Each message in the thread is a **sub-document** with `senderRole`, `content`, `imageUrl`, and `timestamp` — a classic embedded document pattern in MongoDB.

---

#### `PaymentRequest` — Platform activation payments

| Field | Type | Notes |
|---|---|---|
| `authEmail` | String | Firebase login email |
| `email` | String | Contact email |
| `utrNumber` | String (unique) | Bank transaction reference |
| `paymentType` | Enum | `activation` / `extra_slot` |
| `amount` | Number | Amount paid |
| `status` | Enum | `pending` / `approved` / `rejected` / `expired` |
| `expiresAt` | Date | Auto-expiry via TTL index |

**TTL Index (Time-To-Live):**
```js
paymentRequestSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { status: 'pending' } }
);
```
MongoDB automatically deletes pending payment documents after 24 hours using this TTL index — a production-grade data management technique.

---

#### `LicenseKey` — Activation & Redeem keys

| Field | Type | Notes |
|---|---|---|
| `key` | String (unique) | The license key string |
| `type` | Enum | `activation` / `redeem` |
| `isUsed` | Boolean | Usage flag |
| `usedBy` | String | UID of user who redeemed it |
| `usedAt` | Date | Redemption timestamp |

---

#### `Streak` — Daily study streaks

| Field | Type | Notes |
|---|---|---|
| `userId` | String (unique) | One record per user |
| `currentStreak` | Number | Consecutive active days |
| `bestStreak` | Number | Personal best |
| `lastActiveDate` | String | Date string (YYYY-MM-DD) |
| `totalActiveDays` | Number | Lifetime active days |
| `weeklyActivity` | Array[7] of Boolean | Mon–Sun activity grid |

---

#### `StudyCircle` — Group study rooms

| Field | Type | Notes |
|---|---|---|
| `name` | String (max 50) | Circle name |
| `circleCode` | String (unique) | Join code |
| `createdBy` | String | Owner UID |
| `members` | Array of objects | Member list with roles |
| `joinRequests` | Array of sub-docs | Pending join requests |
| `messages` | Array of sub-docs | Real-time chat history (max 500 chars/msg) |
| `maxMembers` | Number (default: 30) | Capacity cap |

---

#### `Bookmark` — Saved questions

| Field | Type | Notes |
|---|---|---|
| `studentId` | String | Owner |
| `questionId` | String | Cross-DB reference to Questions DB |
| `questionText` | String | Denormalized copy for display |
| `subject` | String | For filtering |

> `questionId` is stored as a **String** (not ObjectId) because it references a document on a different MongoDB cluster — a deliberate cross-DB design choice.

---

#### `Note` — Study notes uploaded by teachers

| Field | Type | Notes |
|---|---|---|
| `teacherId` | String | Owner |
| `bankId` | ObjectId | Linked bank |
| `noteType` | Enum | `complete` / `short` / `flash` |
| `fileUrl` | String | Cloudinary URL |
| `public_id` | String | Cloudinary resource ID |
| `format` | String | Default: `pdf` |

---

#### `AccessRequest` — Student bank join requests

| Field | Type | Notes |
|---|---|---|
| `studentId` | String | Requester |
| `bankId` | ObjectId (ref: Bank) | Target bank |
| `teacherId` | String | Bank owner |
| `status` | Enum | `pending` / `approved` / `active` / `rejected` / `locked` |
| `otpHash` | String | Hashed OTP for verification |
| `otpExpiresAt` | Date | OTP expiry |
| `otpAttempts` | Number | Brute-force protection counter |

---

#### `ActivityLog` — Audit trail

| Field | Type | Notes |
|---|---|---|
| `userId` | String | Who performed the action |
| `type` | Enum (15 types) | Event type (e.g., `question_added`, `test_completed`) |
| `title` | String | Short description |
| `description` | String | Detailed log message |
| `ip` | String | IP address for security |

Supported event types: `question_added`, `paper_generated`, `student_approved`, `doubt_received`, `test_completed`, `note_uploaded`, `bank_joined`, `doubt_replied`, `chapter_deleted`, `bank_deleted`, `bank_created`, `key_activated`, `payment_submitted`, `user_blocked`, `user_deleted`

---

#### `AppSettings` — Platform-wide configuration

A **key-value store** collection used to manage dynamic settings without redeployment:

| Key | Default Value | Purpose |
|---|---|---|
| `maintenance_mode` | `false` | Enable/disable maintenance page |
| `maintenance_message` | Text string | Custom downtime message |
| `announcement_active` | `false` | Toggle live announcement |
| `announcement_text` | `""` | Announcement body |
| `announcement_target` | `"all"` | Audience: `all` / `teacher` / `student` |
| `announcement_expires` | `null` | Optional expiry date |
| `activation_price` | `250` | Cost for platform activation (₹) |
| `extra_slot_price` | `100` | Cost per extra subject slot (₹) |
| `allowed_origins` | Array of URLs | CORS whitelist |

Changes made through the admin dashboard are **persisted to MongoDB** and reflected platform-wide in real time.

---

#### `AdminSession`, `AiChat`, `Announcement`, `Blacklist`, `Feedback`, `Quote`, `SystemConfig`

Additional supporting collections for admin security sessions, AI chat history, global announcements, IP/user blacklisting, user feedback, daily motivational quotes, and system configuration respectively.

---

## 4. Indexing Strategy

Indexes are explicitly defined on all high-traffic query paths to ensure sub-millisecond query times:

| Collection | Index | Purpose |
|---|---|---|
| `User` | `{ role: 1 }` | Filter teachers vs students |
| `Question` | `{ teacherId, class, subject, questionType }` | Paper generation |
| `Question` | `{ bankId, questionType, isImportant }` | Important question filter |
| `Bank` | `{ teacherId, subject, class }` (unique) | One bank per teacher-subject-class |
| `Bank` | `{ approvedStudents }` | Student lookup |
| `AccessRequest` | `{ bankId, studentId }` (unique) | One request per student per bank |
| `PaymentRequest` | `{ utrNumber }` (unique) | Prevent duplicate submissions |
| `PaymentRequest` | `{ expiresAt }` (TTL) | Auto-delete stale records |
| `Bookmark` | `{ studentId, questionId }` (unique) | One bookmark per question |
| `ActivityLog` | `{ userId, createdAt: -1 }` | Recent activity feed |
| `Doubt` | `{ teacherId, unreadByTeacher, createdAt }` | Unread doubt dashboard |
| `StudyCircle` | `{ members.userId }` | Circle membership lookup |

---

## 5. Cross-Database Reference Pattern

Since questions live on a different cluster than banks/users, Mongoose's built-in `populate()` cannot be used across clusters. BEEPREPARE handles this via **manual cross-DB references**:

```js
// bankId stored as a plain String in the Question model (not ObjectId ref)
bankId: { type: String }   // Cross-ref to Bank on Main DB

// Then resolved manually in controllers:
const bank = await Bank.findById(bankId);   // queries Main DB connection
const questions = await Question.find({ bankId: bank._id.toString() }); // queries Questions DB
```

This pattern is a deliberate engineering decision that maintains data integrity while supporting multi-cluster isolation.

---

## 6. Lazy Model Initialization (Proxy Pattern)

All 21 Mongoose models use a **JavaScript Proxy** pattern to defer model registration until after the database connection is established:

```js
let _User = null;
module.exports = new Proxy(function() {}, {
  get(_, prop) {
    if (!_User) _User = getMainConn().model('User', userSchema);
    return _User[prop];
  }
});
```

This prevents `"Model not registered"` errors in serverless environments (Vercel) where the connection may not exist at module load time. It is a production-grade pattern for cloud-deployed Node.js apps.

---

## 7. Data Validation

Data integrity is enforced at **three levels**:

1. **Mongoose Schema Level** — `required`, `unique`, `enum`, `minlength`, `maxlength`, `default` constraints on every field
2. **express-validator** — Input validation middleware on API routes before data reaches the database
3. **express-mongo-sanitize** — Strips MongoDB operators (`$`, `.`) from request bodies to prevent **NoSQL injection attacks**

---

## 8. Summary

| Metric | Value |
|---|---|
| Database System | MongoDB (Atlas, Cloud-hosted) |
| ODM | Mongoose v8.10.0 |
| Total Collections | 21 |
| MongoDB Clusters | 2 (Main + Questions) |
| Indexes Defined | 20+ compound & single-field indexes |
| TTL Indexes | 1 (PaymentRequest auto-expiry) |
| Security Measures | NoSQL injection sanitization, OTP hashing (bcrypt), IP logging |
| Deployment Target | Vercel (serverless) with connection caching |

The database layer in BEEPREPARE demonstrates practical application of core DBMS concepts including **schema design, normalization vs. denormalization trade-offs, indexing for performance, referential integrity across distributed stores, TTL-based data lifecycle management, and security-hardened input handling**.

---

*Document prepared by Varshith Rao | BEEPREPARE Project | April 2026*
