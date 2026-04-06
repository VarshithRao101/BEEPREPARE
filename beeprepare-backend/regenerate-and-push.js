require('dotenv').config();
const { db } = require('./config/firebase');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const generateRandomString = (length) => {
    let result = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
        result += CHARSET[bytes[i] % CHARSET.length];
    }
    return result;
};

const generateActivationKey = () => `BEE-${generateRandomString(4)}-${generateRandomString(4)}-${generateRandomString(4)}`;
const generateRedeemKey = () => `BEE-${generateRandomString(6)}`;

async function deleteAllKeysPaginated(collectionName) {
    console.log(`🗑️ Clearing ${collectionName} (Paginated)...`);
    let deleted = 0;
    while (true) {
        const snapshot = await db.collection(collectionName).limit(500).get();
        if (snapshot.empty) break;

        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        
        deleted += snapshot.size;
        console.log(`🧹 Purged: ${deleted}...`);
        // Rate-limiting delay
        await new Promise(r => setTimeout(r, 800));
    }
    console.log(`✅ ${collectionName} cleared.`);
}

async function uploadInBatches(collectionName, keysData) {
    console.log(`🚀 Uploading ${keysData.length} keys to ${collectionName}...`);
    const BATCH_SIZE = 450;
    for (let i = 0; i < keysData.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = keysData.slice(i, i + BATCH_SIZE);
        chunk.forEach(data => {
            const docRef = db.collection(collectionName).doc(data.key);
            batch.set(docRef, data);
        });
        await batch.commit();
        console.log(`📤 Progress: ${i + chunk.length}/${keysData.length}`);
        await new Promise(r => setTimeout(r, 1000));
    }
}

async function start() {
    try {
        console.log('✨ Regenerating All 25,000 Keys (AllCaps + 0-9)...');
        
        const activationKeys = [];
        const actSet = new Set();
        while (actSet.size < 10000) actSet.add(generateActivationKey());
        Array.from(actSet).forEach(key => activationKeys.push({ key, type: 'activation', isUsed: false, plan: 'premium', createdAt: new Date().toISOString() }));

        const redeemKeys = [];
        const redSet = new Set();
        while (redSet.size < 15000) redSet.add(generateRedeemKey());
        Array.from(redSet).forEach(key => redeemKeys.push({ key, type: 'redeem', isUsed: false, value: 1, createdAt: new Date().toISOString() }));

        // 1. DELETE EVERYTHING PAGINATED (SAFEST)
        await deleteAllKeysPaginated('activation_keys');
        await deleteAllKeysPaginated('redeem_keys');

        // 2. UPLOAD EVERYTHING
        await uploadInBatches('activation_keys', activationKeys);
        await uploadInBatches('redeem_keys', redeemKeys);

        // 3. EXPORT CSV
        const csvRows = [['key', 'type', 'isUsed', 'plan', 'value'].join(',')];
        activationKeys.forEach(k => csvRows.push([k.key, k.type, k.isUsed, k.plan, ''].join(',')));
        redeemKeys.forEach(k => csvRows.push([k.key, k.type, k.isUsed, '', k.value].join(',')));
        fs.writeFileSync(path.join(__dirname, 'beeprepare_keys_final.csv'), csvRows.join('\n'));
        
        console.log('\n🏁 ENTIRE PROCESS COMPLETE!');
        console.log('\n--- ACTIVATION (5) ---');
        console.log(activationKeys.slice(0, 5).map(k => k.key).join('\n'));
        console.log('\n--- REDEEM (5) ---');
        console.log(redeemKeys.slice(0, 5).map(k => k.key).join('\n'));
        
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
    process.exit();
}

start();
