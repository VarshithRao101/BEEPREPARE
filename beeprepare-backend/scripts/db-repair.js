const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const { connectDB } = require('../config/db');
const Bank = require('../models/Bank');
const Question = require('../models/Question');

async function run() {
  try {
    console.log('[DB Repair] Connecting to databases...');
    await connectDB();
    console.log('[DB Repair] Connected successfully!');

    // Fetch all banks and cache them
    const banks = await Bank.find({}).lean();
    const banksMap = {};
    banks.forEach(b => {
      banksMap[String(b._id)] = b;
    });
    console.log(`[DB Repair] Found ${banks.length} banks in main database.`);

    // Fetch all questions
    const questions = await Question.find({});
    console.log(`[DB Repair] Found ${questions.length} questions in auxiliary database.`);

    let updateCount = 0;

    for (const q of questions) {
      const bank = banksMap[q.bankId];
      if (!bank) {
        // Skip orphaned questions
        continue;
      }

      // Check if chapterName is missing, "undefined", or chapterIndex is mismatch
      const isMissingName = !q.chapterName || q.chapterName === 'undefined';
      
      // Let's resolve chapter from bank
      const chapter = bank.chapters.find(c => c.chapterId === q.chapterId);
      
      if (chapter) {
        let needsUpdate = false;
        
        if (isMissingName) {
          q.chapterName = chapter.chapterName;
          needsUpdate = true;
        }

        const correctIndex = bank.chapters.findIndex(c => c.chapterId === chapter.chapterId);
        if (q.chapterIndex !== correctIndex) {
          q.chapterIndex = correctIndex;
          needsUpdate = true;
        }

        if (needsUpdate) {
          await q.save();
          updateCount++;
          console.log(`[UPDATED] Q: [${q._id}] text: "${q.questionText.slice(0, 40)}..." | Type: "${q.questionType}" | Chapter resolved: "${chapter.chapterName}" (Index: ${correctIndex})`);
        }
      } else {
        // Handle general chapter if not matched
        if (q.chapterId === 'general' && (!q.chapterName || q.chapterName !== 'General' || q.chapterIndex !== 0)) {
          q.chapterName = 'General';
          q.chapterIndex = 0;
          await q.save();
          updateCount++;
          console.log(`[UPDATED GENERAL] Q: [${q._id}] set to General`);
        }
      }
    }

    console.log(`\n[DB Repair] Done! Successfully updated ${updateCount} questions.`);
    process.exit(0);
  } catch (err) {
    console.error('[DB Repair] Fatal error:', err);
    process.exit(1);
  }
}

run();
