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

const generateActivationKey = () => {
    const p1 = generateRandomString(4);
    const p2 = generateRandomString(4);
    const p3 = generateRandomString(4);
    return `BEE-${p1}-${p2}-${p3}`;
};

const generateRedeemKey = () => {
    return `BEE${generateRandomString(6)}`;
};

const createKeys = (count, generator, type) => {
    const keys = new Set();
    while (keys.size < count) {
        keys.add(generator());
    }
    return Array.from(keys).map(key => ({
        key,
        type,
        is_used: false,
        created_at: new Date().toISOString()
    }));
};

const writeCSV = (filePath, headers, data) => {
    const rows = [headers.join(',')];
    data.forEach(row => {
        rows.push(Object.values(row).join(','));
    });
    fs.writeFileSync(filePath, rows.join('\n'));
};

const main = () => {
    console.log('🚀 Generating 10,000 Activation Keys...');
    const activationKeys = createKeys(10000, generateActivationKey, 'activation');
    
    console.log('🚀 Generating 15,000 Redeem Keys...');
    const redeemKeys = createKeys(15000, generateRedeemKey, 'redeem');

    // JSON export
    const jsonPath = path.join(__dirname, 'beeprepare_keys.json');
    fs.writeFileSync(jsonPath, JSON.stringify([...activationKeys, ...redeemKeys], null, 2));

    // CSV for Activation
    console.log('📁 Writing CSV files...');
    writeCSV(path.join(__dirname, 'beeprepare_activation_keys.csv'), ['key', 'type', 'is_used', 'created_at'], activationKeys);
    
    // CSV for Redeem (with slot value)
    const redeemCSVData = redeemKeys.map(k => ({ ...k, value: '1 slot' }));
    writeCSV(path.join(__dirname, 'beeprepare_redeem_keys.csv'), ['key', 'type', 'is_used', 'created_at', 'value'], redeemCSVData);

    console.log('✨ 25,000 Keys Successfully Generated!');
    console.log('✅ beeprepare_activation_keys.csv');
    console.log('✅ beeprepare_redeem_keys.csv');
    console.log('✅ beeprepare_keys.json');
};

main();
