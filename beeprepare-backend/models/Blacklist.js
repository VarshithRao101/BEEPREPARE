const mongoose = require('mongoose');

const blacklistSchema = new mongoose.Schema({
    ip: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    reason: String,
    strikes: {
        type: Number,
        default: 1
    },
    isPermanentlyBanned: {
        type: Boolean,
        default: false
    },
    lastAttempt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Auto-expire non-permanent bans after 24 hours
blacklistSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400, partialFilterExpression: { isPermanentlyBanned: false } });
blacklistSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Blacklist', blacklistSchema);
