
require('dotenv').config();
const mongoose = require('mongoose');

async function checkIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    
    if (collections.some(c => c.name === 'users')) {
      const indexes = await mongoose.connection.db.collection('users').indexes();
      console.log('Indexes on users collection:', JSON.stringify(indexes, null, 2));
    } else {
      console.log('Users collection not found');
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error during index check:', err);
    process.exit(1);
  }
}

checkIndexes();
