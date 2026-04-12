require('dotenv').config();
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function test() {
  try {
    const result = await cloudinary.api.ping();
    console.log('✅ Cloudinary Connection Successful:', result);
  } catch (err) {
    console.error('❌ Cloudinary Connection Failed:', err.message);
  }
}

test();
