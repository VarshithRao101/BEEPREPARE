const admin = require('firebase-admin');
const path = require('path');

async function testWrite() {
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
    `${project}`
  ];

  console.log('--- STARTING WRITE TEST ---');
  for (const bucketName of variations) {
    try {
      console.log('Testing bucket:', bucketName);
      const bucket = admin.storage().bucket(bucketName);
      const file = bucket.file('test-connection.txt');
      await file.save('Connection test ' + Date.now());
      console.log('✅ WRITE SUCCESS:', bucketName);
      await file.delete();
      console.log('✅ CLEANUP SUCCESS');
      process.exit(0);
    } catch (err) {
      console.log('❌ FAIL:', bucketName, '-', err.message);
    }
  }
  console.log('---------------------------');
  process.exit(1);
}

testWrite();
