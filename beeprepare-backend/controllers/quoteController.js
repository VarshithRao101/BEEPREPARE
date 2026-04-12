const Quote = require('../models/Quote');
const { success, error } = require('../utils/responseHelper');
const crypto = require('crypto');

/**
 * Generates a consistent numeric hash from a string (today's date)
 * @param {string} str - The date string YYYY-MM-DD
 * @returns {number}
 */
const getHash = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
};

// 1. GET /api/quotes/all
const getAllQuotes = async (req, res) => {
    try {
        const quotes = await Quote.find({});
        return success(res, 'All quotes fetched', quotes);
    } catch (err) {
        console.error('getAllQuotes error:', err);
        return error(res, 'Failed to fetch quotes', 'SERVER_ERROR', 500);
    }
};

// 2. GET /api/quotes/today
const getTodayQuote = async (req, res) => {
    try {
        const quotes = await Quote.find({});
        if (!quotes || quotes.length === 0) {
            return success(res, 'No quotes found', {
                text: "Keep the BEE matrix aligned with your goals.",
                author: "BEE Team"
            });
        }

        // Core Logic: Daily Fixed Random
        // Use UTC date to ensure all users see the same quote regardless of local midnight
        const today = new Date().toISOString().split('T')[0]; 
        const hash = getHash(today);
        const index = hash % quotes.length;
        
        const quote = quotes[index];

        return success(res, 'Today\'s quote fetched', {
            id: quote._id,
            text: quote.text,
            author: quote.author,
            category: quote.category,
            date: today
        });
    } catch (err) {
        console.error('getTodayQuote error:', err);
        return error(res, 'Failed to fetch today\'s quote', 'SERVER_ERROR', 500);
    }
};

module.exports = {
    getAllQuotes,
    getTodayQuote
};
