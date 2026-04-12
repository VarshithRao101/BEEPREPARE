const mongoose = require('mongoose');
const Bank = require('./beeprepare-backend/models/Bank');
const Question = require('./beeprepare-backend/models/Question');
require('dotenv').config({ path: './beeprepare-backend/.env' });

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const banks = await Bank.find({ subject: 'Chemistry', class: 'Class 10' });
  for (const b of banks) {
    console.log(`Bank ${b._id}: ${b.subject} ${b.class}`);
    const questions = await Question.find({ bankId: b._id }).lean();
    console.log('Total questions found directly:', questions.length);
    for (const c of b.chapters) {
       console.log(`- Chapter: ${c.chapterName} (${c.chapterId})`);
       const cqs = questions.filter(q => q.chapterId === c.chapterId);
       console.log(`    क्वेश्चंस : ${cqs.length}`);
    }
  }
  process.exit(0);
}
check();
