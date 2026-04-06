require('dotenv').config();
const { db } = require('./config/firebase');

async function inspect() {
    console.log('🔍 Querying Firestore for Activation Keys...');
    try {
        const snapshot = await db.collection('activation_keys').limit(10).get();
        if (snapshot.empty) {
            console.log('❌ NO KEYS FOUND IN FIRESTORE "activation_keys" collection!');
            return;
        }
        
        console.log(`✅ Found ${snapshot.size} keys. Listing details:`);
        snapshot.forEach(doc => {
            console.log(`ID: "${doc.id}" | Data:`, doc.data());
        });
    } catch (err) {
        console.error('❌ Firestore Error:', err.message);
    }
    process.exit();
}

inspect();
