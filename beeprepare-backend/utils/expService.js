const User = require('../models/User');

/**
 * EXP Service — Handles student experience points accumulation
 */
exports.awardExp = async (userId, action, customAmount = null) => {
    try {
        let amount = 0;
        
        if (customAmount !== null) {
            amount = customAmount;
        } else {
            switch (action) {
                case 'PAPER_GENERATED':
                    amount = 50;
                    break;
                case 'DAILY_STREAK':
                    amount = 20;
                    break;
                case 'AI_DOUBT_SOLVED':
                    amount = 10;
                    break;
                case 'TEST_COMPLETED':
                    amount = 100;
                    break;
                case 'BANK_ADDED':
                    amount = 15;
                    break;
                default:
                    amount = 0;
            }
        }

        if (amount === 0) return;

        // Atomic update to prevent race conditions
        await User.findOneAndUpdate(
            { googleUid: userId },
            { 
                $inc: { 
                    exp: amount, 
                    dailyExp: amount, 
                    monthlyExp: amount, 
                    yearlyExp: amount 
                } 
            }
        );

        console.log(`[EXP] Awarded ${amount} to ${userId} for ${action}`);
    } catch (err) {
        console.error('[EXP ERROR]', err);
    }
};
