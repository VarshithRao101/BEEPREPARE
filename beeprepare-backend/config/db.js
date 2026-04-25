const mongoose = require('mongoose');

// Cache connections for serverless environments (Vercel)
let cachedMain = global.mongooseMain;
if (!cachedMain) {
  cachedMain = global.mongooseMain = { conn: null, promise: null };
}

let cachedQuestions = global.mongooseQuestions;
if (!cachedQuestions) {
  cachedQuestions = global.mongooseQuestions = { conn: null, promise: null };
}

// Global Mongoose settings
mongoose.set('strictQuery', true);
mongoose.set('bufferCommands', false);

const connectDB = async () => {
  // 1. Connect to Main App DB (Cluster 2)
  if (!cachedMain.conn) {
    if (!cachedMain.promise) {
      console.log('[DB] Establishing new connection to Main DB...');
      const opts = {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
      };
      cachedMain.promise = mongoose.connect(process.env.MONGODB_URI, opts).then((m) => {
        console.log('✅ Main MongoDB connected');
        return m.connection;
      });
    }
    try {
      cachedMain.conn = await cachedMain.promise;
    } catch (e) {
      cachedMain.promise = null;
      console.error('❌ Main DB Connection Error:', e.message);
      throw e;
    }
  }

  // 2. Connect to Questions DB (Cluster 1)
  if (!cachedQuestions.conn) {
    if (!cachedQuestions.promise) {
      console.log('[DB] Establishing new connection to Questions DB...');
      const opts = {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
      };
      // We use createConnection for the secondary cluster
      const conn = mongoose.createConnection(process.env.MONGODB_QUESTIONS_URI, opts);
      cachedQuestions.promise = new Promise((resolve, reject) => {
        conn.on('connected', () => {
          console.log('✅ Questions MongoDB connected');
          resolve(conn);
        });
        conn.on('error', (err) => {
          console.error('❌ Questions DB Connection Error:', err.message);
          reject(err);
        });
      });
    }
    try {
      cachedQuestions.conn = await cachedQuestions.promise;
    } catch (e) {
      cachedQuestions.promise = null;
      throw e;
    }
  }

  return { main: cachedMain.conn, questions: cachedQuestions.conn };
};

const getMainConn = () => {
  if (!cachedMain.conn) throw new Error('Main DB not connected. Call connectDB() first.');
  return cachedMain.conn;
};

const getQuestionsConn = () => {
  if (!cachedQuestions.conn) throw new Error('Questions DB not connected. Call connectDB() first.');
  return cachedQuestions.conn;
};

module.exports = { connectDB, getMainConn, getQuestionsConn };
