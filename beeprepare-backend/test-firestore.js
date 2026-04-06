const admin = require('firebase-admin');
const path = require('path');

async function testFirestore() {
  const serviceAccountPath = path.join(__dirname, 'firebase-admin.json');
  const serviceAccount = require(serviceAccountPath);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }

  try {
    const db = admin.firestore();
    const docRef = db.collection('test').doc('connection');
    await docRef.set({ success: true, timestamp: new Date() });
    console.log('✅ FIRESTORE SUCCESS');
    await docRef.delete();
    console.log('✅ FIRESTORE CLEANUP SUCCESS');
  } catch (err) {
    console.error('❌ FIRESTORE FAIL:', err.message);
  }
  process.exit(0);
}

testFirestore();
