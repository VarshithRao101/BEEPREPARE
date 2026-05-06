require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB, getQuestionsConn } = require('../config/db');
const Bank = require('../models/Bank');
const Question = require('../models/Question');

async function sync() {
    try {
        console.log('--- Starting Matrix Metadata Sync ---');
        await connectDB();
        
        const mainDb = mongoose.connection;
        const qDb = getQuestionsConn();
        
        const banks = await Bank.find({});
        console.log(`Found ${banks.length} banks to process.`);

        let totalUpdated = 0;
        let totalSkipped = 0;

        for (const bank of banks) {
            const questions = await Question.find({ bankId: String(bank._id) });
            console.log(`Processing Bank: ${bank.subject} (Class ${bank.class}) - ${questions.length} questions`);

            for (const q of questions) {
                let updated = false;
                
                // 1. Sync chapterIndex
                if (q.chapterId) {
                    const idx = bank.chapters.findIndex(c => c.chapterId === q.chapterId);
                    if (idx !== -1 && q.chapterIndex !== idx) {
                        q.chapterIndex = idx;
                        updated = true;
                    }
                }

                // 2. Sync numericId
                if (!q.numericId) {
                    const lastQ = await Question.findOne({}, { numericId: 1 }).sort({ numericId: -1 });
                    q.numericId = (lastQ && lastQ.numericId) ? lastQ.numericId + 1 : 1;
                    updated = true;
                }

                if (updated) {
                    await q.save();
                    totalUpdated++;
                } else {
                    totalSkipped++;
                }
            }
        }

        console.log(`\nSync Complete!`);
        console.log(`Updated: ${totalUpdated} questions`);
        console.log(`Skipped: ${totalSkipped} questions (already correct)`);
        
        process.exit(0);
    } catch (err) {
        console.error('Sync failed:', err);
        process.exit(1);
    }
}

sync();
