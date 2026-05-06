require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB, getQuestionsConn } = require('./config/db');
const Question = require('./models/Question');

async function run() {
    await connectDB();
    // Wait for async connection
    let retries = 0;
    while (retries < 10) {
        try {
            if (getQuestionsConn()) break;
        } catch (e) {
            retries++;
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    const counts = await Question.aggregate([{ $group: { _id: '$questionType', count: { $sum: 1 } } }]);
    console.log('Question Type Counts:', JSON.stringify(counts, null, 2));
    
    const sample = await Question.findOne({ questionType: 'Long' });
    console.log('Sample Long Question:', JSON.stringify(sample, null, 2));
    
    process.exit(0);
}

run();
