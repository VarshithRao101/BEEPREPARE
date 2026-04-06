require('dotenv').config();
require('../config/firebase');
const { db } = require('../config/firebase');
const User = require('../models/User');
const connectDB = require('../config/db');

const recoverKeys = async () => {
  await connectDB();

  // Step 1: List ALL keys in Firestore that are marked isUsed=true
  const snapshot = await db
    .collection('activation_keys')
    .where('isUsed', '==', true)
    .get();

  console.log('Used keys found in Firestore:', snapshot.size);

  snapshot.forEach(doc => {
    console.log('Key:', doc.id,
      '| Used by:', doc.data().usedBy,
      '| Used at:', doc.data().usedAt);
  });

  // Step 2: Reset ALL used keys back to unused
  if (process.env.NODE_ENV !== 'development') {
    console.log('Only runs in dev mode!');
    process.exit(1);
  }

  const batch = db.batch();
  snapshot.forEach(doc => {
    batch.update(doc.ref, {
      isUsed: false,
      usedBy: null,
      usedAt: null
    });
  });
  
  if (snapshot.size > 0) {
    await batch.commit();
    console.log('All keys reset to unused ✅');
  } else {
    console.log('No keys to reset.');
  }

  // Step 3: Fix MongoDB users that have licenseKey set but isActivated=false
  const brokenUsers = await User.find({
    licenseKey: { $ne: null },
    isActivated: false
  });

  console.log('Broken users found in MongoDB:', brokenUsers.length);

  for (const user of brokenUsers) {
    await User.updateOne(
      { _id: user._id },
      { isActivated: true }
    );
    console.log('Fixed user:', user.email);
  }

  // Step 4: Also fix users with NO role but isActivated=true
  const noRoleUsers = await User.find({
    isActivated: true,
    role: null
  });
  console.log('Users stuck at role select:', noRoleUsers.length);
  noRoleUsers.forEach(u =>
    console.log(' -', u.email)
  );

  console.log('Recovery complete! 🐝');
  process.exit(0);
};

recoverKeys().catch(err => {
  console.error('Recovery failed:', err);
  process.exit(1);
});
