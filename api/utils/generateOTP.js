const bcrypt = require('bcryptjs');

const generateOTP = async () => {
  const plain = Math.floor(1000 + Math.random() * 9000).toString();
  const hash = await bcrypt.hash(plain, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10);
  return { plain, hash };
};

module.exports = generateOTP;
