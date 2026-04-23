/**
 * BEEPREPARE — Fresh Start Database Cleanup & Setup Script
 * =========================================================
 * What this script does:
 *  1. Connects to BOTH clusters
 *  2. Wipes ALL data from Cluster 2 (q74oac9) — Questions DB
 *  3. Wipes ALL data from Cluster 1 (z39ztxf) — Main DB (Users, Banks, etc.)
 *  4. Drops all collections in both clusters
 *  5. Creates fresh indexes on both clusters
 *
 * Run: node scripts/fresh-start.js
 *
 * ⚠️  THIS IS DESTRUCTIVE — ALL DATA WILL BE PERMANENTLY DELETED
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const MAIN_URI       = process.env.MONGODB_URI;
const QUESTIONS_URI  = process.env.MONGODB_QUESTIONS_URI;

if (!MAIN_URI || !QUESTIONS_URI) {
  console.error('❌ Missing MONGODB_URI or MONGODB_QUESTIONS_URI in .env');
  process.exit(1);
}

const dropAllCollections = async (conn, label) => {
  const db = conn.db;
  const collections = await db.listCollections().toArray();
  if (collections.length === 0) {
    console.log(`  [${label}] No collections to drop.`);
    return;
  }
  for (const col of collections) {
    await db.dropCollection(col.name);
    console.log(`  [${label}] Dropped: ${col.name}`);
  }
};

const run = async () => {
  console.log('\n🐝 BEEPREPARE — Fresh Start Script');
  console.log('===================================\n');

  // ── Connect both clusters ─────────────────────────────────────────────────
  console.log('⏳ Connecting to Cluster 1 (Main DB)...');
  const mainConn = await mongoose.createConnection(MAIN_URI).asPromise();
  console.log('✅ Cluster 1 connected:', mainConn.db.databaseName);

  console.log('⏳ Connecting to Cluster 2 (Questions DB)...');
  const questionsConn = await mongoose.createConnection(QUESTIONS_URI).asPromise();
  console.log('✅ Cluster 2 connected:', questionsConn.db.databaseName);

  // ── 1. Wipe Cluster 2 (Questions DB) ─────────────────────────────────────
  console.log('\n🗑️  Wiping Cluster 2 (Questions DB)...');
  await dropAllCollections(questionsConn, 'Cluster2/Questions');
  console.log('✅ Cluster 2 wiped clean.\n');

  // ── 2. Wipe Cluster 1 (Main DB) ───────────────────────────────────────────
  console.log('🗑️  Wiping Cluster 1 (Main DB)...');
  await dropAllCollections(mainConn, 'Cluster1/Main');
  console.log('✅ Cluster 1 wiped clean.\n');

  // ── 3. Create Question indexes on Cluster 2 ───────────────────────────────
  console.log('📐 Creating Question indexes on Cluster 2...');
  const questionsCol = questionsConn.db.collection('questions');
  await questionsCol.createIndex({ teacherId: 1, class: 1, subject: 1, chapterId: 1, questionType: 1 });
  await questionsCol.createIndex({ bankId: 1, chapterId: 1, questionType: 1, isImportant: 1 });
  await questionsCol.createIndex({ bankId: 1, chapterId: 1 });
  await questionsCol.createIndex({ createdBy: 1 });
  console.log('✅ Question indexes created.\n');

  // ── 4. Create indexes on Cluster 1 ────────────────────────────────────────
  console.log('📐 Creating indexes on Cluster 1...');

  const usersCol = mainConn.db.collection('users');
  await usersCol.createIndex({ googleUid: 1 }, { unique: true });
  await usersCol.createIndex({ email: 1 }, { unique: true });
  await usersCol.createIndex({ role: 1 });
  console.log('  ✅ users indexes');

  const banksCol = mainConn.db.collection('banks');
  await banksCol.createIndex({ teacherId: 1 });
  await banksCol.createIndex({ teacherId: 1, subject: 1, class: 1 }, { unique: true });
  await banksCol.createIndex({ bankCode: 1 }, { unique: true });
  await banksCol.createIndex({ approvedStudents: 1 });
  console.log('  ✅ banks indexes');

  const notesCol = mainConn.db.collection('notes');
  await notesCol.createIndex({ bankId: 1, chapterId: 1, noteType: 1 }, { unique: true });
  await notesCol.createIndex({ teacherId: 1 });
  console.log('  ✅ notes indexes');

  const streaksCol = mainConn.db.collection('streaks');
  await streaksCol.createIndex({ userId: 1 }, { unique: true });
  console.log('  ✅ streaks indexes');

  const accessRequestsCol = mainConn.db.collection('accessrequests');
  await accessRequestsCol.createIndex({ bankId: 1, studentId: 1 }, { unique: true });
  await accessRequestsCol.createIndex({ teacherId: 1, status: 1 });
  console.log('  ✅ accessrequests indexes');

  const activityLogsCol = mainConn.db.collection('activitylogs');
  await activityLogsCol.createIndex({ userId: 1, createdAt: -1 });
  console.log('  ✅ activitylogs indexes');

  const doubtsCol = mainConn.db.collection('doubts');
  await doubtsCol.createIndex({ teacherId: 1, unreadByTeacher: 1, createdAt: -1 });
  await doubtsCol.createIndex({ studentId: 1, createdAt: -1 });
  console.log('  ✅ doubts indexes');

  const testSessionsCol = mainConn.db.collection('testsessions');
  await testSessionsCol.createIndex({ studentId: 1, status: 1, createdAt: -1 });
  console.log('  ✅ testsessions indexes');

  const paymentRequestsCol = mainConn.db.collection('paymentrequests');
  await paymentRequestsCol.createIndex({ utrNumber: 1 }, { unique: true });
  await paymentRequestsCol.createIndex({ status: 1 });
  await paymentRequestsCol.createIndex({ email: 1 });
  await paymentRequestsCol.createIndex({ expiresAt: 1 }, {
    expireAfterSeconds: 0,
    partialFilterExpression: { status: 'pending' }
  });
  console.log('  ✅ paymentrequests indexes');

  const adminSessionsCol = mainConn.db.collection('adminsessions');
  await adminSessionsCol.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  console.log('  ✅ adminsessions indexes');

  const appSettingsCol = mainConn.db.collection('appsettings');
  await appSettingsCol.createIndex({ key: 1 }, { unique: true });
  console.log('  ✅ appsettings indexes');

  const bookmarksCol = mainConn.db.collection('bookmarks');
  await bookmarksCol.createIndex({ studentId: 1, questionId: 1 }, { unique: true });
  console.log('  ✅ bookmarks indexes');

  const blacklistCol = mainConn.db.collection('blacklists');
  await blacklistCol.createIndex({ email: 1 }, { unique: true });
  console.log('  ✅ blacklists indexes');

  const aiChatsCol = mainConn.db.collection('aichats');
  await aiChatsCol.createIndex({ userId: 1, lastMessageAt: -1 });
  console.log('  ✅ aichats indexes');

  console.log('\n✅ All Cluster 1 indexes created.\n');

  // ── 5. Seed default AppSettings ───────────────────────────────────────────
  console.log('🌱 Seeding default AppSettings on Cluster 1...');
  const defaultSettings = [
    { key: 'maintenance_mode', value: false, updatedBy: 'system', updatedAt: new Date() },
    { key: 'maintenance_message', value: 'We are upgrading BEEPREPARE. Back soon!', updatedBy: 'system', updatedAt: new Date() },
    { key: 'announcement_active', value: false, updatedBy: 'system', updatedAt: new Date() },
    { key: 'announcement_text', value: '', updatedBy: 'system', updatedAt: new Date() },
    { key: 'announcement_target', value: 'all', updatedBy: 'system', updatedAt: new Date() },
    { key: 'announcement_expires', value: null, updatedBy: 'system', updatedAt: new Date() },
    { key: 'activation_price', value: 250, updatedBy: 'system', updatedAt: new Date() },
    { key: 'extra_slot_price', value: 100, updatedBy: 'system', updatedAt: new Date() },
  ];
  await appSettingsCol.insertMany(defaultSettings);
  console.log('✅ AppSettings seeded.\n');

  // ── Done ──────────────────────────────────────────────────────────────────
  await mainConn.close();
  await questionsConn.close();

  console.log('🎉 FRESH START COMPLETE!');
  console.log('   Cluster 1 (Main DB):       CLEAN ✅');
  console.log('   Cluster 2 (Questions DB):  CLEAN ✅');
  console.log('   All indexes:               CREATED ✅');
  console.log('   AppSettings:               SEEDED ✅');
  console.log('\nYou can now restart the server with: npm run dev\n');
  process.exit(0);
};

run().catch(err => {
  console.error('\n❌ Fresh start script failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
