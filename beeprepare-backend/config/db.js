const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('⏳ Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected ✅');
  } catch (err) {
    console.error('MongoDB connection failed ❌', err.message);
    process.exit(1); // Exit if DB connection fails to avoid state inconsistencies
  }
};

mongoose.connection.on('error', err => {
  console.error('MongoDB error after connection ❌', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected ⚠️');
});

module.exports = connectDB;
