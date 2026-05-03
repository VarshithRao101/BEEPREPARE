require('dotenv').config({ path: 'beeprepare-backend/.env' });
const { connectDB } = require('./beeprepare-backend/config/db');
const Announcement = require('./beeprepare-backend/models/Announcement');

async function run() {
  await connectDB();
  try {
    await Announcement.updateMany({}, { isActive: false });
    console.log('SUCCESS updateMany');
    const a = await Announcement.create({
      text: 'Test',
      target: 'all',
      isActive: true
    });
    console.log('SUCCESS create', a);
  } catch (err) {
    console.error('ERROR', err);
  }
  process.exit();
}
run();
