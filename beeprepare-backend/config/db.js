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
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    bufferCommands: false,
    maxPoolSize: 10,
  };

  cached.promise = (async () => {
    try {
      if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI missing');
      if (!process.env.MONGODB_QUESTIONS_URI) throw new Error('MONGODB_QUESTIONS_URI missing');

      console.log('Connecting to Main and Questions DB concurrently...');
      const [mainConnMongoose, questionsConn] = await Promise.all([
        mongoose.connect(process.env.MONGODB_URI, opts),
        mongoose.createConnection(process.env.MONGODB_QUESTIONS_URI, opts).asPromise()
      ]);
      
      cached.mainConn = mongoose.connection;
      cached.questionsConn = questionsConn;
      console.log('Both DBs connected successfully.');

      cached.mainConn.on('disconnected', () => {
        console.error('Main DB disconnected');
        cached.mainConn = null;
        cached.promise = null;
      });

      cached.questionsConn.on('disconnected', () => {
        console.error('Questions DB disconnected');
        cached.questionsConn = null;
        cached.promise = null;
      });

      cached.mainConn.on('error', (err) => console.error('Main DB error:', err.message));
      cached.questionsConn.on('error', (err) => console.error('Questions DB error:', err.message));

      return { mainConn: cached.mainConn, questionsConn: cached.questionsConn };

    } catch (err) {
      cached.promise = null;
      cached.mainConn = null;
      cached.questionsConn = null;
      console.error('MongoDB connection failed:', err.message);
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
