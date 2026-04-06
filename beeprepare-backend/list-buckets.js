const admin = require('firebase-admin');
const path = require('path');

async function listBuckets() {
  const serviceAccountPath = path.join(__dirname, 'firebase-admin.json');
  const serviceAccount = require(serviceAccountPath);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }

  try {
    const [buckets] = await admin.storage().getBuckets();
    console.log('--- FOUND BUCKETS ---');
    buckets.forEach(b => console.log('BUCKET:', b.name));
    console.log('---------------------');
  } catch (err) {
    console.error('ERROR LISTING BUCKETS:', err.message);
  }
  process.exit(0);
}

listBuckets();
