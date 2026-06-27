const mongoose = require('mongoose');

let cached = global._mongooseCache;
if (!cached) {
  cached = global._mongooseCache = {
    mainConn: null,
    questionsConn: null,
    promise: null
  };
}

const connectDB = async () => {
  if (cached.mainConn && cached.questionsConn) {
    return { mainConn: cached.mainConn, questionsConn: cached.questionsConn };
  }

  if (cached.promise) return cached.promise;

  const opts = {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 30000,
    bufferCommands: false,
    maxPoolSize: 10,
    minPoolSize: 2,
    compressors: 'zlib',
  };

  cached.promise = (async () => {
    try {
      if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI missing');
      if (!process.env.MONGODB_QUESTIONS_URI) throw new Error('MONGODB_QUESTIONS_URI missing');

      console.log('[Database] Connecting to Main DB...');
      await mongoose.connect(process.env.MONGODB_URI, opts);
      cached.mainConn = mongoose.connection;
      console.log('[Database] Main DB connected.');

      console.log('[Database] Connecting to Questions DB (Auxiliary)...');
      const qConn = await mongoose.createConnection(process.env.MONGODB_QUESTIONS_URI, opts).asPromise();
      cached.questionsConn = qConn;
      console.log('[Database] Questions DB connected.');

      qConn.on('disconnected', () => {
        console.error('[Database] Questions DB disconnected');
        cached.questionsConn = null;
        cached.promise = null; // Clean promise cache so next request reconnects both DBs
      });
      qConn.on('error', (err) => console.error('[Database] Questions DB error:', err.message));

      if (mongoose.connection.listenerCount('disconnected') === 0) {
        mongoose.connection.on('disconnected', () => {
          console.error('[Database] Main DB disconnected');
          cached.mainConn = null;
          cached.promise = null; // Clean promise cache so next request reconnects both DBs
        });
      }

      if (mongoose.connection.listenerCount('error') === 0) {
        mongoose.connection.on('error', (err) => console.error('[Database] Main DB error:', err.message));
      }

      return { mainConn: cached.mainConn, questionsConn: cached.questionsConn }; 
    } catch (err) {
      cached.promise = null;
      cached.mainConn = null;
      cached.questionsConn = null;
      console.error('[Database] MongoDB main connection failed:', err.message);
      throw err;
    }
  })();

  return cached.promise;
};

const getMainConn = () => {
  if (!cached.mainConn) throw new Error('Main DB not connected. Call connectDB() first.');
  return cached.mainConn;
};

const getQuestionsConn = () => {
  if (!cached.questionsConn) throw new Error('Questions DB not connected. Call connectDB() first.');
  return cached.questionsConn;
};

module.exports = {
  connectDB,
  getMainConn,
  getQuestionsConn,
  mainConn: () => cached.mainConn,
  questionsConn: () => cached.questionsConn
};
