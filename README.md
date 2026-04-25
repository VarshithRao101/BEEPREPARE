# 🐝 BEEPREPARE — The Ultimate Academic Preparation Node

![BEEPREPARE Banner](assets/images/premium-bg.png)

> **Institutional-grade preparation platform for students and educators.**  
> Built with a high-security architecture, real-time synchronization, and AI-driven insights.

## 🏗️ Architecture Overview

BEEPREPARE is designed as a **Unified Full-Stack Application** optimized for **Vercel** serverless deployment.

- **Frontend**: Premium Glassmorphism UI (Vanilla HTML5/CSS3/JS)
- **Backend**: Robust Node.js & Express API
- **Database**: MongoDB Atlas (Primary Data)
- **Identity**: Firebase Authentication & Admin SDK
- **Security**: 12-Layer "Fortress" Middleware Stack

## 🚀 Deployment (Vercel)

This project is pre-configured for Vercel. To deploy:

1.  **Fork/Clone** this repository.
2.  Connect the repository to **Vercel**.
3.  Add the following **Environment Variables** in Vercel Settings:
    - `MONGO_URI`: Your MongoDB Connection String.
    - `FIREBASE_SERVICE_ACCOUNT`: The full JSON from your `firebase-admin.json`.
    - `JWT_SECRET`: A long random string for auth tokens.
    - `ADMIN_GATE_KEY`: Secret key to access the rolling gateway.
    - `ALLOWED_ORIGINS`: Set to your production URL.
4.  Click **Deploy**.

## 🛡️ Security Features

- **Matrix Vault**: Identity-verified admin credentials management.
- **Rolling Gateway**: Time-based dynamic paths for admin entry points.
- **Fortress Stack**: Protection against SQLi, XSS, and NoSQL injection.
- **CSRF Protection**: Stateful token validation for all write operations.
- **Rate Limiting**: Intelligent limiting for AI, Auth, and Payment nodes.

## 📁 Directory Structure

```text
├── beeprepare-backend/   # Node.js Express API Engine
├── beginners/            # Student & Teacher Frontend Modules
├── matrix-core-v1419/    # Secure Admin Management Dashboard
├── assets/               # Shared Design Systems & Core JS
├── index.html            # Central Entry Node
└── vercel.json           # Unified Deployment Logic
```

## 🛠️ Local Development

1.  Clone the repo.
2.  Install dependencies: `npm install`.
3.  Start the backend: `cd beeprepare-backend && npm run dev`.
4.  Open `index.html` via a local server (Live Server).

---

© 2026 BEEPREPARE Institutional. All rights reserved.
