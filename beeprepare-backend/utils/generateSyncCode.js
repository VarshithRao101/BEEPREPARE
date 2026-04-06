const Bank = require('../models/Bank');

const generateSyncCode = async () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const rand = (n) => Array(n).fill(0)
    .map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
  let code, exists;
  do {
    code = `TRNT-${rand(4)}-${rand(4)}`;
    exists = await Bank.findOne({ bankCode: code });
  } while (exists);
  return code;
};

module.exports = generateSyncCode;
