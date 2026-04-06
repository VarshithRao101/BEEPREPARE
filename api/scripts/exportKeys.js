const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { db } = require('../config/firebase');

async function exportCollection(collectionName, fileName) {
    console.log(`📂 Starting export of [${collectionName}]...`);
    const filePath = path.join(__dirname, '..', fileName);
    const writeStream = fs.createWriteStream(filePath);

    // Get a sample document to determine headers
    try {
        const sampleDoc = await db.collection(collectionName).limit(1).get();
        if (sampleDoc.empty) {
            console.log(`⚠️ Collection [${collectionName}] is empty.`);
            return 0;
        }

        const headers = Object.keys(sampleDoc.docs[0].data());
        writeStream.write(headers.join(',') + '\n');

        let count = 0;
        let lastDoc = null;
        const BATCH_SIZE = 500; // Smaller batch size to avoid heavy loads

        while (true) {
            let query = db.collection(collectionName).orderBy('__name__').limit(BATCH_SIZE);
            if (lastDoc) {
                query = query.startAfter(lastDoc);
            }

            const snapshot = await query.get();
            if (snapshot.empty) break;

            snapshot.forEach(doc => {
                const data = doc.data();
                const row = headers.map(header => {
                    let value = data[header];
                    if (value && value.toDate) { // Handle Firestore Timestamps
                        value = value.toDate().toISOString();
                    } else if (value === null || value === undefined) {
                        value = '';
                    } else if (typeof value === 'string' && value.includes(',')) {
                        value = `"${value}"`;
                    }
                    return value;
                });
                writeStream.write(row.join(',') + '\n');
                count++;
            });

            lastDoc = snapshot.docs[snapshot.docs.length - 1];
            console.log(`   Exported [${count}] documents...`);
        }

        writeStream.end();
        console.log(`✅ Finished exporting [${count}] documents to ${fileName}.\n`);
        return count;
    } catch (err) {
        if (err.message.includes('RESOURCE_EXHAUSTED')) {
            console.error(`❌ Firestore Quota Exceeded for [${collectionName}]. Use local backup if available.`);
        } else {
            console.error(`❌ Error exporting [${collectionName}]:`, err.message);
        }
        return 0;
    }
}

async function main() {
    try {
        console.log('--- EXPORTING FIRESTORE KEYS ---');
        const activationCount = await exportCollection('activation_keys', 'activation_keys.csv');
        const redeemCount = await exportCollection('redeem_keys', 'redeem_keys.csv');

        console.log('--- SUMMARY ---');
        console.log(`Total Activation Keys found: ${activationCount}`);
        console.log(`Total Redeem Codes found: ${redeemCount}`);
        console.log(`Created: activation_keys.csv`);
        console.log(`Created: redeem_keys.csv`);
    } catch (err) {
        console.error('❌ Export failed:', err);
    }
}

main();
