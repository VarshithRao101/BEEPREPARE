const { Storage } = require('@google-cloud/storage');
const path = require('path');

async function listAllBuckets() {
  const serviceAccountPath = path.join(__dirname, 'firebase-admin.json');
  
  const storage = new Storage({
    keyFilename: serviceAccountPath,
  });

  try {
    const [buckets] = await storage.getBuckets();
    console.log('--- ACTUAL BUCKETS IN THIS ACCOUNT ---');
    buckets.forEach(b => console.log('BUCKET:', b.name));
    console.log('--------------------------------------');
  } catch (err) {
    console.error('ERROR:', err.message);
  }
}

listAllBuckets();
