
require('dotenv').config();
const mongoose = require('mongoose');

async function cleanBankIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const collections = await db.listCollections({ name: 'banks' }).toArray();
    
    if (collections.length > 0) {
      console.log('Dropping all indexes on banks collection (except _id)...');
      await db.collection('banks').dropIndexes();
      console.log('Bank indexes dropped successfully. Mongoose will recreate them from the schema on next startup.');
    } else {
      console.log('Banks collection not found.');
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error cleaning bank indexes:', err);
    process.exit(1);
  }
}

cleanBankIndexes();
