
require('dotenv').config();
const mongoose = require('mongoose');

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const users = await db.collection('users').find({}).toArray();
    console.log('Users in database:', JSON.stringify(users.map(u => ({ email: u.email, googleUid: u.googleUid })), null, 2));
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error checking users:', err);
    process.exit(1);
  }
}

checkUsers();
