const admin = require('firebase-admin');

if (!admin.apps.length) {
  let credential;
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Production: read from environment variable JSON
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = admin.credential.cert(serviceAccount);
    } catch (err) {
      console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', err.message);
    }
  } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    // Production: read from individual environment variables
    try {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey
      });
    } catch (err) {
      console.error('❌ Failed to initialize Firebase with individual credentials:', err.message);
    }
  } else {
    // Development: read from local JSON file
    try {
      const path = require('path');
      const serviceAccountPath = path.join(__dirname, '..', 'firebase-admin.json');
      const serviceAccount = require(serviceAccountPath);
      credential = admin.credential.cert(serviceAccount);
    } catch (err) {
      console.warn('⚠️ Firebase credentials not found. Auth services will be restricted.');
    }
  }

  if (credential) {
    try {
      admin.initializeApp({
        credential,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`
      });
      console.log('✅ Firebase initialized successfully');
    } catch (err) {
      console.error('❌ Firebase initializeApp failed:', err.message);
    }
  }
}

// Helper to safely get services
const getDb = () => {
  try {
    return admin.apps.length ? admin.firestore() : null;
  } catch (e) {
    return null;
  }
};

const getAuth = () => {
  try {
    return admin.apps.length ? admin.auth() : null;
  } catch (e) {
    return null;
  }
};

const getBucket = () => {
  try {
    return admin.apps.length ? admin.storage().bucket() : null;
  } catch (e) {
    return null;
  }
};

module.exports = { 
  admin, 
  get db() { return getDb(); },
  get auth() { return getAuth(); },
  get bucket() { return getBucket(); },
  // Backwards compatibility for direct access (risky if not initialized)
  db: getDb(),
  auth: getAuth(),
  bucket: getBucket()
};

