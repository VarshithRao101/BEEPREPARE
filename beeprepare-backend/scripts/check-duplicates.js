
require('dotenv').config();
const mongoose = require('mongoose');

async function checkDuplicates() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const users = await db.collection('users').find({}).toArray();
    
    const emails = {};
    for (const user of users) {
      if (emails[user.email]) {
        console.log(`DUPLICATE EMAIL FOUND: ${user.email}`);
        console.log(`- User 1 UID: ${emails[user.email]}`);
        console.log(`- User 2 UID: ${user.googleUid}`);
      } else {
        emails[user.email] = user.googleUid;
      }
    }
    
    if (Object.keys(emails).length === users.length) {
      console.log('No duplicate emails found in the database.');
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error checking duplicates:', err);
    process.exit(1);
  }
}

checkDuplicates();
