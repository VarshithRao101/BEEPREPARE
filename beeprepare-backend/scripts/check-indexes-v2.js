
require('dotenv').config();
const mongoose = require('mongoose');

async function checkIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Check all models for index issues
    for (const modelName of mongoose.modelNames()) {
      const Model = mongoose.model(modelName);
      console.log(`Checking indexes for ${modelName}:`);
      console.log(Model.schema.indexes());
    }
    
    // Check actual database indexes
    const collections = await mongoose.connection.db.listCollections().toArray();
    for (const coll of collections) {
      console.log(`Actual indexes for ${coll.name}:`);
      const indexes = await mongoose.connection.db.collection(coll.name).indexes();
      console.log(JSON.stringify(indexes, null, 2));
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error checking indexes:', err);
    process.exit(1);
  }
}

checkIndexes();
