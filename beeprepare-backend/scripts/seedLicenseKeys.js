require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('../config/firebase');
const { db } = require('../config/firebase');

const seedKeys = async () => {
  console.log('Seeding license keys to Firestore...');

  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year from now

  // 5 Basic keys (3 subject slots)
  const basicKeys = ['BASIC00000001','BASIC00000002','BASIC00000003','BASIC00000004','BASIC00000005'];
  // 3 Premium keys (10 subject slots)
  const premiumKeys = ['PREM000000001','PREM000000002','PREM000000003'];

  for (const key of basicKeys) {
    await db.collection('activation_keys').doc(key).set({
      key, plan: 'basic', subjectLimit: 3,
      isUsed: false, assignedTo: null,
      expiresAt, createdAt: new Date()
    });
    console.log(`✅ Basic key added: ${key}`);
  }

  for (const key of premiumKeys) {
    await db.collection('activation_keys').doc(key).set({
      key, plan: 'premium', subjectLimit: 10,
      isUsed: false, assignedTo: null,
      expiresAt, createdAt: new Date()
    });
    console.log(`✅ Premium key added: ${key}`);
  }

  console.log('Done! All test keys seeded. 🐝');
  process.exit(0);
};

seedKeys().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
