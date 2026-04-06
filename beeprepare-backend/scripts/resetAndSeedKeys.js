require('dotenv').config();
const { db, admin } = require('../config/firebase');
const crypto = require('crypto');

// --- 🏗️ CONFIG ---
const ACTIVATION_COUNT = 10000;
const REDEEM_COUNT = 15000;
const BATCH_SIZE = 500;

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// --- 🔑 GENERATION LOGIC ---

const generateSegment = (len) => {
    let result = '';
    const bytes = crypto.randomBytes(len);
    for (let i = 0; i < len; i++) {
        result += CHARS[bytes[i] % CHARS.length];
    }
    return result;
};

const generateActivationKey = () => {
    // Format: BEE-XXXX-XXXX-XXXX
    return `BEE-${generateSegment(4)}-${generateSegment(4)}-${generateSegment(4)}`;
};

const generateRedeemKey = () => {
    // Format: BEEXXXXXX
    return `BEE${generateSegment(6)}`;
};

// --- 🔥 DATABASE OPERATIONS ---

async function deleteCollection(collectionName) {
    console.log(`🧹 Purging [${collectionName}]...`);
    const collectionRef = db.collection(collectionName);
    const query = collectionRef.orderBy('__name__').limit(BATCH_SIZE);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(query, resolve) {
    const snapshot = await query.get();
    const batchSize = snapshot.size;
    if (batchSize === 0) {
        resolve();
        return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`   Deleted batch of [${batchSize}]...`);

    process.nextTick(() => {
        deleteQueryBatch(query, resolve);
    });
}

async function seedCollection(collectionName, keys, dataGenerator) {
    console.log(`🚀 Seeding [${collectionName}] with [${keys.length}] keys...`);
    
    let batch = db.batch();
    let count = 0;

    for (const key of keys) {
        const docRef = db.collection(collectionName).doc(key);
        batch.set(docRef, dataGenerator(key));
        count++;

        if (count % BATCH_SIZE === 0) {
            await batch.commit();
            console.log(`   Inserted [${count}]...`);
            batch = db.batch();
        }
    }

    if (count % BATCH_SIZE !== 0) {
        await batch.commit();
    }
    console.log(`✅ [${collectionName}] complete.`);
}

// --- 🏁 MAIN EXECUTION ---

const main = async () => {
    try {
        console.log('--- EXECUTING SYSTEM RESET ---');

        // 1. Delete Old
        await deleteCollection('activation_keys');
        await deleteCollection('redeem_keys');

        // 2. Generate Unique Activation Keys
        console.log('--- GENERATING ACTIVATION KEYS ---');
        const activationKeysSet = new Set();
        while (activationKeysSet.size < ACTIVATION_COUNT) {
            activationKeysSet.add(generateActivationKey());
        }
        const activationKeysArray = Array.from(activationKeysSet);

        // 3. Generate Unique Redeem Keys
        console.log('--- GENERATING REDEEM KEYS ---');
        const redeemKeysSet = new Set();
        while (redeemKeysSet.size < REDEEM_COUNT) {
            redeemKeysSet.add(generateRedeemKey());
        }
        const redeemKeysArray = Array.from(redeemKeysSet);

        // 4. Seed Activation Keys
        await seedCollection('activation_keys', activationKeysArray, (key) => ({
            key,
            isUsed: false,
            assignedTo: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            usedAt: null
        }));

        // 5. Seed Redeem Keys
        await seedCollection('redeem_keys', redeemKeysArray, (key) => ({
            key,
            value: 1,
            isUsed: false,
            assignedTo: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            usedAt: null
        }));

        console.log('\n--- 🐝 ALL KEYS RESET & RE-SEEDED SUCCESSFULLY ---');
        process.exit(0);
    } catch (err) {
        console.error('❌ CRITICAL FAILURE:', err);
        process.exit(1);
    }
};

main();
