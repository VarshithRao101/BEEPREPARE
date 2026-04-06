const admin = require('firebase-admin');
const path = require('path');

async function probeBuckets() {
  const serviceAccountPath = path.join(__dirname, 'firebase-admin.json');
  const serviceAccount = require(serviceAccountPath);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }

  const project = serviceAccount.project_id;
  const variations = [
    `${project}.appspot.com`,
    `${project}.firebasestorage.app`,
    `gs://${project}.appspot.com`,
    `${project}`,
    `${project}-default-bucket`
  ];

  console.log('--- STARTING BUCKET PROBE ---');
  for (const bucketName of variations) {
    try {
      const bucket = admin.storage().bucket(bucketName);
      await bucket.exists();
      console.log('✅ MATCH FOUND:', bucketName);
      process.exit(0);
    } catch (err) {
      console.log('❌ FAIL:', bucketName, '-', err.message);
    }
  }
  console.log('-----------------------------');
  console.log('CRITICAL: NO BUCKETS MATCHED. CHECK FIREBASE CONSOLE.');
  process.exit(1);
}

probeBuckets();
