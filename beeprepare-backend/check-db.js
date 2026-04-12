const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
  try {
    console.log('Connecting to:', process.env.MONGODB_URI.substring(0, 30) + '...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected');
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collectionsfound:', collections.map(c => c.name));
    
    for (const coll of collections) {
      const count = await mongoose.connection.db.collection(coll.name).countDocuments();
      console.log(`- ${coll.name}: ${count} docs`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Check failed:', err);
    process.exit(1);
  }
}
check();
