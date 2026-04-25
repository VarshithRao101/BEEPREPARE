# BEEPREPARE Backend Engine

This is the core API powering the BEEPREPARE ecosystem. It handles data persistence, authentication, and high-security admin operations.

## Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: Mongoose (MongoDB)
- **Authentication**: Firebase Admin SDK & JWT
- **Logging**: Winston
- **Validation**: Zod & Express-Validator

## Security Layers
The backend implements a **12-Layer Security Stack** via the `fortress` middleware:
1.  Scanner Block: Rejects known bot headers and patterns.
2.  NoSQL Injection: Deep sanitization of MongoDB queries.
3.  XSS Protection: HTML sanitization for all user inputs.
4.  HPP: Prevents HTTP Parameter Pollution.
5.  CSRF: Token-based verification for admin actions.

## API Endpoints
- /api/auth: Identity management and session sync.
- /api/student: Student-specific logic (papers, circles).
- /api/teacher: Teacher-specific logic (study circles, requests).
- /api/admin: Protected management functions.
- /api/ai: Integration with Generative AI models.

## Setup
1. npm install
2. Create a .env file based on the environment requirements.
3. npm start for production or npm run dev for development.

---
**Note**: When deploying to Vercel, this directory is treated as a serverless function entry point via server.js.
