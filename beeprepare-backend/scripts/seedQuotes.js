const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Quote = require('../models/Quote');

const seedQuotes = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const dataPath = path.join(__dirname, '../data/quotes.json');
        const quotes = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

        console.log(`Found ${quotes.length} quotes in JSON.`);

        // Clear existing quotes
        await Quote.deleteMany({});
        console.log('Cleared existing quotes.');

        // Insert new quotes
        await Quote.insertMany(quotes.map(q => ({
            text: q.text,
            author: q.author,
            category: q.category
        })));

        console.log('Successfully seeded quotes!');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding quotes:', err.message);
        process.exit(1);
    }
};

seedQuotes();
