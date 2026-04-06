
require('dotenv').config();
const mongoose = require('mongoose');

async function fixUserIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const usersColl = db.collection('users');
    
    const indexes = await usersColl.indexes();
    console.log('Current indexes on users collection:', JSON.stringify(indexes, null, 2));
    
    // Check for unique index on 'role'
    const roleIndex = indexes.find(idx => idx.name === 'role_1' || (idx.key && idx.key.role));
    if (roleIndex && roleIndex.unique) {
      console.log('Dropping UNIQUE index on role...');
      await usersColl.dropIndex(roleIndex.name);
      console.log('Unique index on role dropped. Mongoose will recreate it without unique constraint on restart.');
    } else {
      console.log('No unique index on role found.');
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error fixing user indexes:', err);
    process.exit(1);
  }
}

fixUserIndexes();
