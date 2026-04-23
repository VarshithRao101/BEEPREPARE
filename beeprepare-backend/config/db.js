const mongoose = require('mongoose');

// ── Connection instances ───────────────────────────────────────────────────
// mainConn     → Cluster 2 — Users, Banks, Notes, Sessions, etc.
// questionsConn → Cluster 1 — Questions ONLY
let mainConn = null;
let questionsConn = null;

const connectDB = async () => {
  try {
    // ── 1. Main DB connection (Cluster 2) ─────────────────────────────────
    console.log('⏳ Connecting to Main App DB (Cluster 2)...');
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is missing from environment variables');
    }
    console.log(`URI Type: ${typeof process.env.MONGODB_URI}, Starts with: ${process.env.MONGODB_URI.substring(0, 10)}...`);
    mainConn = await mongoose.createConnection(process.env.MONGODB_URI);
    console.log('✅ Main App DB connected (Cluster 2 - App State)');

    // ── 2. Questions DB connection (Cluster 1) ────────────────────────────
    console.log('⏳ Connecting to Questions DB (Cluster 1)...');
    questionsConn = await mongoose.createConnection(process.env.MONGODB_QUESTIONS_URI);
    console.log('✅ Questions DB connected (Cluster 1 - Academic Engine)');

    // ── Runtime Reconnection Handlers ─────────────────────────────────────
    
    mainConn.on('disconnected', () => {
      console.error('❌ Main DB disconnected! Attempting reconnect...');
      setTimeout(async () => {
        try {
          await mainConn.openUri(process.env.MONGODB_URI);
          console.log('✅ Main DB reconnected');
        } catch (err) {
          console.error('Main DB reconnect failed:', err.message);
        }
      }, 5000);
    });

    questionsConn.on('disconnected', () => {
      console.error('❌ Questions DB disconnected! Attempting reconnect...');
      setTimeout(async () => {
        try {
          await questionsConn.openUri(process.env.MONGODB_QUESTIONS_URI);
          console.log('✅ Questions DB reconnected');
        } catch (err) {
          console.error('Questions DB reconnect failed:', err.message);
        }
      }, 5000);
    });

    mainConn.on('error', (err) => {
      console.error('Main DB error:', err.message);
    });

    questionsConn.on('error', (err) => {
      console.error('Questions DB error:', err.message);
    });

  } catch (err) {
    console.error('MongoDB connection failed ❌', err.message);
    process.exit(1);
  }
};

const getMainConn = () => {
  if (!mainConn) throw new Error('Main DB not connected. Call connectDB() first.');
  return mainConn;
};

const getQuestionsConn = () => {
  if (!questionsConn) throw new Error('Questions DB not connected. Call connectDB() first.');
  return questionsConn;
};

module.exports = { 
  connectDB, 
  getMainConn, 
  getQuestionsConn,
  mainConn: () => mainConn,
  questionsConn: () => questionsConn
};

