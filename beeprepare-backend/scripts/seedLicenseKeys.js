require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('../config/firebase');
const { db } = require('../config/firebase');

const seedKeys = async () => {
  console.log('Seeding standard activation/redeem keys to Firestore...');

  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year from now

  // 5 Activation keys (Sets ACTIVE + 2 slots)
  const activationKeys = ['BEE-TEST-001','BEE-TEST-002','BEE-TEST-003','BEE-TEST-004','BEE-TEST-005'];
  // 5 Redeem keys (Adds +1 slot)
  const redeemKeys = ['RDM-TEST-001','RDM-TEST-002','RDM-TEST-003','RDM-TEST-004','RDM-TEST-005'];

  for (const key of activationKeys) {
    await db.collection('activation_keys').doc(key).set({
      key, 
      type: 'activation',
      isUsed: false, 
      usedBy: null,
      usedAt: null,
      expiresAt: null, // Unlimited/Manual
      createdAt: new Date()
    });
    console.log(`✅ Activation key added: ${key}`);
  }

  for (const key of redeemKeys) {
    await db.collection('activation_keys').doc(key).set({
      key, 
      type: 'redeem',
      isUsed: false, 
      usedBy: null,
      usedAt: null,
      expiresAt: null,
      createdAt: new Date()
    });
    console.log(`✅ Redeem key added: ${key}`);
  }

  console.log('Done! Standard keys seeded. 🐝');
  process.exit(0);
};

seedKeys().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
