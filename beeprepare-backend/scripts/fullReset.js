const mongoose = require('mongoose');
require('dotenv').config();
require('../config/firebase');

const runFullReset = async () => {
  console.log('🔴 BEEPREPARE FULL RESET STARTING...');
  console.log('This will delete ALL data.');

  // Connect both DBs
  const { connectDB, getMainConn, getQuestionsConn } = require('../config/db');
  await connectDB();
  
  const mainConn = getMainConn();
  const questionsConn = getQuestionsConn();

  // Wait for connections
  await new Promise(r => setTimeout(r, 3000));

  // === WIPE MONGODB CLUSTER 2 (Main) ===
  console.log('Wiping Main DB (Cluster 2)...');
  const mainDB = mainConn.db;
  const mainCollections = await mainDB
    .listCollections().toArray();

  for (const col of mainCollections) {
    // Keep admin sessions and app settings
    if (col.name === 'adminsessions' ||
        col.name === 'appsettings') {
      console.log(`Keeping: ${col.name}`);
      continue;
    }
    await mainDB.collection(col.name)
      .deleteMany({});
    console.log(`✅ Wiped: ${col.name}`);
  }

  // === WIPE MONGODB CLUSTER 1 (Questions) ===
  console.log('Wiping Questions DB (Cluster 1)...');
  const questionsDB = questionsConn.db;
  const qCollections = await questionsDB
    .listCollections().toArray();

  for (const col of qCollections) {
    await questionsDB.collection(col.name)
      .deleteMany({});
    console.log(`✅ Wiped questions: ${col.name}`);
  }

  // === WIPE FIRESTORE ===
  console.log('Wiping Firestore...');
  const { db } = require('../config/firebase');

  const fsCollections = ['activation_keys', 'redeem_codes', 'login_logs'];
  const FS_BATCH_LIMIT = 400;

  for (const colName of fsCollections) {
    const snap = await db.collection(colName).get();
    console.log(`Deleting ${snap.size} docs from Firestore: ${colName}...`);
    
    let docs = snap.docs;
    for (let i = 0; i < docs.length; i += FS_BATCH_LIMIT) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + FS_BATCH_LIMIT);
      chunk.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      console.log(`  - Deleted batch ${Math.floor(i/FS_BATCH_LIMIT) + 1} for ${colName}`);
    }
    console.log(`✅ Wiped Firestore: ${colName}`);
  }

  console.log('🟢 ALL DATA WIPED SUCCESSFULLY');
  console.log('Now generating fresh keys...');

  // === PHASE 2: GENERATE FRESH KEYS IN MONGODB ===

  // Create LicenseKey model in Main DB
  const licenseKeySchema = new mongoose.Schema({
    key: {
      type: String,
      required: true,
      unique: true
    },
    type: {
      type: String,
      enum: ['activation', 'redeem'],
      required: true
    },
    isUsed: {
      type: Boolean,
      default: false
    },
    usedBy: {
      type: String,
      default: null
    },
    usedAt: {
      type: Date,
      default: null
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  });

  licenseKeySchema.index({ key: 1 },
    { unique: true });
  licenseKeySchema.index({ isUsed: 1 });
  licenseKeySchema.index({ type: 1 });
  licenseKeySchema.index({ usedBy: 1 });

  const LicenseKey = mainConn.model(
    'LicenseKey', licenseKeySchema);

  // Generate key function
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const generateKey = (type) => {
    const seg = () => {
      let s = '';
      for (let i = 0; i < 4; i++) {
        s += chars[Math.floor(
          Math.random() * chars.length)];
      }
      return s;
    };
    const prefix = type === 'activation'
      ? 'BEE' : 'RDM';
    return `${prefix}-${seg()}-${seg()}-${seg()}`;
  };

  // Generate 10,000 activation keys
  console.log('Generating 10,000 activation keys...');
  const ACTIVATION_TOTAL = 10000;
  const BATCH_SIZE = 500;

  for (let i = 0; i < ACTIVATION_TOTAL;
       i += BATCH_SIZE) {
    const batch = [];
    const count = Math.min(
      BATCH_SIZE, ACTIVATION_TOTAL - i);

    for (let j = 0; j < count; j++) {
      batch.push({
        key: generateKey('activation'),
        type: 'activation',
        isUsed: false
        // NO plan
        // NO subjectSlots
      });
    }

    await LicenseKey.insertMany(batch,
      { ordered: false });
    console.log(`Activation keys: ${i + count} / ${ACTIVATION_TOTAL}`);
  }

  // Generate 15,000 redeem keys
  console.log('Generating 15,000 redeem keys...');
  const REDEEM_TOTAL = 15000;

  for (let i = 0; i < REDEEM_TOTAL;
       i += BATCH_SIZE) {
    const batch = [];
    const count = Math.min(
      BATCH_SIZE, REDEEM_TOTAL - i);

    for (let j = 0; j < count; j++) {
      batch.push({
        key: generateKey('redeem'),
        type: 'redeem',
        isUsed: false
        // NO plan
        // NO subjectSlots
      });
    }

    await LicenseKey.insertMany(batch,
      { ordered: false });
    console.log(`Redeem keys: ${i + count} / ${REDEEM_TOTAL}`);
  }

  console.log('✅ 10,000 activation keys generated');
  console.log('✅ 15,000 redeem keys generated');
  console.log('✅ All keys stored in MongoDB');
  console.log('🎉 RESET COMPLETE! System is fresh.');
  process.exit(0);
};

runFullReset().catch(err => {
  console.error('RESET FAILED:', err);
  process.exit(1);
});
