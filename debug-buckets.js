const admin = require('firebase-admin');
const path = require('path');

async function listBuckets() {
  try {
    const serviceAccountPath = path.join(__dirname, 'beeprepare-backend', 'firebase-admin.json');
    const serviceAccount = require(serviceAccountPath);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    const [buckets] = await admin.storage().getBuckets();
    console.log('--- AVAILABLE BUCKETS ---');
    buckets.forEach(b => console.log(b.name));
    console.log('-------------------------');
    process.exit(0);
  } catch (err) {
    console.error('FAILED TO LIST BUCKETS:', err.message);
    process.exit(1);
  }
}

listBuckets();
