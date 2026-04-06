const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  let credential;
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Production: read from environment variable
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = admin.credential.cert(serviceAccount);
    } catch (err) {
      console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', err.message);
      process.exit(1);
    }
  } else {
    // Development: read from local JSON file
    try {
      const serviceAccountPath = path.join(__dirname, '..', 'firebase-admin.json');
      const serviceAccount = require(serviceAccountPath);
      credential = admin.credential.cert(serviceAccount);
    } catch (err) {
      console.error('❌ Failed to load local firebase-admin.json:', err.message);
      // In development, we don't always want to exit if this is missing (e.g. for simple environment tests), 
      // but for BEEPREPARE core it's usually required.
      process.exit(1); 
    }
  }

  admin.initializeApp({
    credential,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'beeprepare-1d7b8.appspot.com'
  });
}

const db = admin.firestore();
const auth = admin.auth();

// Lazy-load bucket to avoid startup hangs
let bucket;
try {
  bucket = admin.storage().bucket();
} catch (e) {
  console.warn('⚠️ Firebase Storage Bucket initialization failed, but Firestore will continue.');
}

module.exports = { admin, db, bucket, auth };
